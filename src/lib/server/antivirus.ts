/**
 * Antivirus scanning via direct clamd TCP connection.
 *
 * Uses the built-in Node.js `net` module — no npm dependencies.
 * Replaces the `clamscan` npm package which requires local binaries
 * that don't exist in node:20-alpine Docker images.
 */

import { createClient, type ScanResult as ClamdScanResult } from './clamd-client.js';

const CLAMAV_ENABLED = process.env.CLAMAV_ENABLED !== 'false';
const CLAMAV_HOST = process.env.CLAMAV_HOST || 'clamav';
const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT || '3310', 10);
const CLAMAV_TIMEOUT = parseInt(process.env.CLAMAV_TIMEOUT || '60000', 10);

let isAvailable = false;
let retryCount = 0;
const MAX_INIT_RETRIES = 5;
const RETRY_INTERVAL = 30_000; // 30s between retries — covers 150s total

const client = createClient({
	host: CLAMAV_HOST,
	port: CLAMAV_PORT,
	timeout: CLAMAV_TIMEOUT
});

async function initScanner() {
	if (!CLAMAV_ENABLED) {
		console.log('[antivirus] ClamAV disabled via CLAMAV_ENABLED=false');
		return;
	}
	if (isAvailable) return;
	if (retryCount >= MAX_INIT_RETRIES) return;

	retryCount++;
	console.log(`[antivirus] Init attempt ${retryCount}/${MAX_INIT_RETRIES} via TCP: ${CLAMAV_HOST}:${CLAMAV_PORT}`);

	try {
		const pong = await client.ping();
		if (!pong) throw new Error('PING did not return PONG');

		const ver = await client.version();
		isAvailable = true;
		retryCount = 0;
		console.log(`[antivirus] ClamAV connected successfully (${ver})`);
	} catch (err: any) {
		console.warn(`[antivirus] Connection failed: ${err.message}`);
		isAvailable = false;

		if (retryCount < MAX_INIT_RETRIES) {
			console.log(`[antivirus] Retrying in ${RETRY_INTERVAL / 1000}s... (${retryCount}/${MAX_INIT_RETRIES})`);
			setTimeout(() => initScanner(), RETRY_INTERVAL);
		} else {
			console.log('[antivirus] ClamAV not reachable after all retries — file scanning disabled');
			console.log('[antivirus] Will retry on next scan request or file upload');
		}
	}
}

// Non-blocking init at startup
initScanner();

export function isScannerAvailable(): boolean {
	return isAvailable;
}

/**
 * Allow lazy reconnect: reset retry counter so next scan attempt
 * triggers a fresh connection cycle. Called when user requests a scan
 * or uploads a file after ClamAV was previously unreachable.
 */
export function tryReconnect(): void {
	if (!CLAMAV_ENABLED || isAvailable) return;
	if (retryCount >= MAX_INIT_RETRIES) {
		console.log('[antivirus] Reconnect requested — resetting retry counter');
		retryCount = 0;
		initScanner();
	}
}

export interface ScanResult {
	scanned: boolean;
	isInfected: boolean;
	viruses: string[];
	error?: string;
	scanTimeMs: number;
}

export async function scanFile(filePath: string): Promise<ScanResult> {
	const start = Date.now();

	if (!CLAMAV_ENABLED || !isAvailable) {
		return { scanned: false, isInfected: false, viruses: [], error: 'ClamAV not available', scanTimeMs: 0 };
	}

	try {
		const result: ClamdScanResult = await client.scanFile(filePath);
		return {
			scanned: true,
			isInfected: result.isInfected,
			viruses: result.viruses,
			scanTimeMs: Date.now() - start
		};
	} catch (err: any) {
		console.error('[antivirus] Scan error:', err.message);
		if (err.message?.includes('ECONNREFUSED') || err.message?.includes('ENOENT') || err.message?.includes('ETIMEDOUT') || err.message?.includes('timed out')) {
			isAvailable = false;
			// Allow fresh retry cycle after connection loss
			if (retryCount >= MAX_INIT_RETRIES) {
				retryCount = 0;
			}
			setTimeout(() => initScanner(), RETRY_INTERVAL);
		}
		return { scanned: false, isInfected: false, viruses: [], error: err.message, scanTimeMs: Date.now() - start };
	}
}

export async function getStatus(): Promise<{ available: boolean; version?: string; error?: string }> {
	if (!CLAMAV_ENABLED) return { available: false, error: 'Disabled' };
	if (!isAvailable) return { available: false, error: 'Not connected' };
	try {
		const ver = await client.version();
		return { available: true, version: ver || 'unknown' };
	} catch (err: any) {
		return { available: false, error: err.message };
	}
}

export async function isHealthy(): Promise<boolean> {
	if (!CLAMAV_ENABLED || !isAvailable) return false;
	try {
		return await client.ping();
	} catch {
		return false;
	}
}
