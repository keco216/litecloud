/**
 * LiteCloud E2E Encryption — all crypto runs client-side only.
 * Server never sees plaintext or the master key.
 *
 * Flow:
 *   Register → generate salt + master key → wrap master key with password-derived key → store on server
 *   Login    → fetch salt + wrapped key → derive key from password → unwrap master key → sessionStorage
 *   Upload   → encrypt file with master key (AES-256-GCM) → upload ciphertext + IV
 *   Download → fetch ciphertext + IV → decrypt with master key
 */

const PBKDF2_ITERATIONS = 600_000;
const CHUNK_SIZE = 64 * 1024 * 1024; // 64 MB chunks for large files

// ── Helpers ──

function toBase64(buf: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): ArrayBuffer {
	const bin = atob(b64);
	const buf = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
	return buf.buffer;
}

function randomBytes(n: number): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(n));
}

// ── Key Derivation ──

async function deriveKeyFromPassword(
	password: string,
	salt: Uint8Array
): Promise<CryptoKey> {
	const enc = new TextEncoder();
	const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
		'deriveKey'
	]);
	return crypto.subtle.deriveKey(
		{ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
		baseKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

// ── Master Key Management ──

export async function generateEncryptionKeys(password: string): Promise<{
	salt: string;
	encryptedMasterKey: string;
	masterKeyIv: string;
}> {
	const salt = randomBytes(32);
	const passwordKey = await deriveKeyFromPassword(password, salt);

	// Generate random 256-bit master key
	const masterKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
		'encrypt',
		'decrypt'
	]);
	const rawMaster = await crypto.subtle.exportKey('raw', masterKey);

	// Wrap master key with password-derived key
	const iv = randomBytes(12);
	const encryptedMaster = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, passwordKey, rawMaster);

	return {
		salt: toBase64(salt),
		encryptedMasterKey: toBase64(encryptedMaster),
		masterKeyIv: toBase64(iv)
	};
}

export async function unlockMasterKey(
	password: string,
	saltB64: string,
	encryptedMasterKeyB64: string,
	masterKeyIvB64: string
): Promise<CryptoKey> {
	const salt = new Uint8Array(fromBase64(saltB64));
	const passwordKey = await deriveKeyFromPassword(password, salt);
	const iv = new Uint8Array(fromBase64(masterKeyIvB64));
	const encryptedMaster = fromBase64(encryptedMasterKeyB64);

	const rawMaster = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, passwordKey, encryptedMaster);

	return crypto.subtle.importKey('raw', rawMaster, { name: 'AES-GCM', length: 256 }, true, [
		'encrypt',
		'decrypt'
	]);
}

// ── Session Key Storage ──

export async function storeMasterKey(key: CryptoKey): Promise<void> {
	// Store in localStorage so the key persists across browser sessions.
	// Cleared on logout via clearMasterKey(). Same approach as Proton Mail.
	const raw = await crypto.subtle.exportKey('raw', key);
	localStorage.setItem('lc-mk', toBase64(raw));
}

export async function loadMasterKey(): Promise<CryptoKey | null> {
	const b64 = localStorage.getItem('lc-mk');
	if (!b64) return null;
	const raw = fromBase64(b64);
	return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, [
		'encrypt',
		'decrypt'
	]);
}

export function clearMasterKey(): void {
	localStorage.removeItem('lc-mk');
}

// ── File Encryption ──

export async function encryptFile(
	data: ArrayBuffer,
	masterKey: CryptoKey
): Promise<{ ciphertext: ArrayBuffer; iv: string }> {
	const iv = randomBytes(12);

	if (data.byteLength <= CHUNK_SIZE) {
		// Small file — single encrypt
		const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, data);
		return { ciphertext, iv: toBase64(iv) };
	}

	// Large file — chunk-based encryption
	// Each chunk gets its own IV derived from base IV + chunk index
	const chunks: ArrayBuffer[] = [];
	const totalChunks = Math.ceil(data.byteLength / CHUNK_SIZE);

	for (let i = 0; i < totalChunks; i++) {
		const start = i * CHUNK_SIZE;
		const end = Math.min(start + CHUNK_SIZE, data.byteLength);
		const chunk = data.slice(start, end);

		// Derive unique chunk IV: hash(base IV || chunk index) truncated to 12 bytes
		const ivInput = new Uint8Array(16);
		ivInput.set(iv, 0);
		new DataView(ivInput.buffer).setUint32(12, i);
		const chunkIvFull = await crypto.subtle.digest('SHA-256', ivInput);
		const chunkIv = new Uint8Array(chunkIvFull).slice(0, 12);

		const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: chunkIv }, masterKey, chunk);
		chunks.push(encrypted);
	}

	// Prepend 4-byte header: number of chunks
	const header = new ArrayBuffer(4);
	new DataView(header).setUint32(0, totalChunks);
	const totalSize = 4 + chunks.reduce((s, c) => s + 4 + c.byteLength, 0);
	const result = new Uint8Array(totalSize);
	result.set(new Uint8Array(header), 0);
	let offset = 4;
	for (const chunk of chunks) {
		new DataView(result.buffer).setUint32(offset, chunk.byteLength);
		offset += 4;
		result.set(new Uint8Array(chunk), offset);
		offset += chunk.byteLength;
	}

	return { ciphertext: result.buffer, iv: toBase64(iv) };
}

export async function decryptFile(
	ciphertext: ArrayBuffer,
	ivB64: string,
	masterKey: CryptoKey
): Promise<ArrayBuffer> {
	const iv = new Uint8Array(fromBase64(ivB64));

	// Check if this is a chunked file (starts with chunk count header)
	if (ciphertext.byteLength > 4) {
		const possibleChunks = new DataView(ciphertext).getUint32(0);
		if (possibleChunks > 1 && possibleChunks < 100000) {
			// Try chunked decryption
			try {
				return await decryptChunked(ciphertext, iv, masterKey, possibleChunks);
			} catch {
				// Fall through to single decrypt
			}
		}
	}

	// Single-chunk decrypt
	return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, ciphertext);
}

async function decryptChunked(
	data: ArrayBuffer,
	iv: Uint8Array,
	masterKey: CryptoKey,
	totalChunks: number
): Promise<ArrayBuffer> {
	const chunks: ArrayBuffer[] = [];
	let offset = 4; // skip header

	for (let i = 0; i < totalChunks; i++) {
		const chunkSize = new DataView(data).getUint32(offset);
		offset += 4;
		const chunk = data.slice(offset, offset + chunkSize);
		offset += chunkSize;

		const ivInput = new Uint8Array(16);
		ivInput.set(iv, 0);
		new DataView(ivInput.buffer).setUint32(12, i);
		const chunkIvFull = await crypto.subtle.digest('SHA-256', ivInput);
		const chunkIv = new Uint8Array(chunkIvFull).slice(0, 12);

		const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: chunkIv }, masterKey, chunk);
		chunks.push(decrypted);
	}

	const totalSize = chunks.reduce((s, c) => s + c.byteLength, 0);
	const result = new Uint8Array(totalSize);
	let pos = 0;
	for (const chunk of chunks) {
		result.set(new Uint8Array(chunk), pos);
		pos += chunk.byteLength;
	}
	return result.buffer;
}
