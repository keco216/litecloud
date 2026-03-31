import { Crypto } from '@peculiar/webcrypto';

// Polyfill Web Crypto API for jsdom
if (!globalThis.crypto?.subtle) {
  const cryptoImpl = new Crypto();
  Object.defineProperty(globalThis, 'crypto', { value: cryptoImpl, writable: true });
}

const store = new Map<string, string>();
const mockSessionStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear()
};
Object.defineProperty(globalThis, 'sessionStorage', { value: mockSessionStorage, writable: true });

import {
  generateEncryptionKeys,
  unlockMasterKey,
  encryptFile,
  decryptFile,
  storeMasterKey,
  loadMasterKey,
  clearMasterKey
} from './crypto';
import { describe, it, expect, beforeEach } from 'vitest';

const TEST_PASSWORD = 'correct-horse-battery-staple';

describe('generateEncryptionKeys', () => {
  it('returns salt, encryptedMasterKey, and masterKeyIv as non-empty strings', async () => {
    const result = await generateEncryptionKeys(TEST_PASSWORD);

    expect(result.salt).toBeDefined();
    expect(result.salt.length).toBeGreaterThan(0);

    expect(result.encryptedMasterKey).toBeDefined();
    expect(result.encryptedMasterKey.length).toBeGreaterThan(0);

    expect(result.masterKeyIv).toBeDefined();
    expect(result.masterKeyIv.length).toBeGreaterThan(0);
  });
});

describe('unlockMasterKey', () => {
  it('returns a CryptoKey when given the correct password', async () => {
    const keys = await generateEncryptionKeys(TEST_PASSWORD);
    const masterKey = await unlockMasterKey(
      TEST_PASSWORD,
      keys.salt,
      keys.encryptedMasterKey,
      keys.masterKeyIv
    );

    expect(masterKey).toBeDefined();
    expect(masterKey.type).toBe('secret');
    expect(masterKey.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
  });

  it('throws an error when given the wrong password', async () => {
    const keys = await generateEncryptionKeys(TEST_PASSWORD);

    await expect(
      unlockMasterKey('wrong-password', keys.salt, keys.encryptedMasterKey, keys.masterKeyIv)
    ).rejects.toThrow();
  });
});

describe('encryptFile / decryptFile', () => {
  let masterKey: CryptoKey;

  beforeEach(async () => {
    const keys = await generateEncryptionKeys(TEST_PASSWORD);
    masterKey = await unlockMasterKey(
      TEST_PASSWORD,
      keys.salt,
      keys.encryptedMasterKey,
      keys.masterKeyIv
    );
  });

  it('roundtrip: encrypt then decrypt returns the original content', async () => {
    const original = new TextEncoder().encode('Hello, LiteCloud!');
    const { ciphertext, iv } = await encryptFile(original.buffer, masterKey);

    const decrypted = await decryptFile(ciphertext, iv, masterKey);
    const result = new Uint8Array(decrypted);

    expect(result).toEqual(original);
  });

  it('roundtrip with 1KB data', async () => {
    const original = new Uint8Array(1024);
    for (let i = 0; i < original.length; i++) original[i] = i % 256;

    const { ciphertext, iv } = await encryptFile(original.buffer, masterKey);
    const decrypted = await decryptFile(ciphertext, iv, masterKey);

    expect(new Uint8Array(decrypted)).toEqual(original);
  });

  it('roundtrip with 100KB data', async () => {
    const original = new Uint8Array(100 * 1024);
    for (let i = 0; i < original.length; i++) original[i] = i % 256;

    const { ciphertext, iv } = await encryptFile(original.buffer, masterKey);
    const decrypted = await decryptFile(ciphertext, iv, masterKey);

    expect(new Uint8Array(decrypted)).toEqual(original);
  });

  it('produces a different IV each time', async () => {
    const data = new TextEncoder().encode('same content');

    const result1 = await encryptFile(data.buffer, masterKey);
    const result2 = await encryptFile(data.buffer, masterKey);

    expect(result1.iv).not.toBe(result2.iv);
  });
});

describe('storeMasterKey / loadMasterKey / clearMasterKey', () => {
  beforeEach(() => {
    store.clear();
  });

  it('storeMasterKey + loadMasterKey roundtrip', async () => {
    // Generate an extractable master key so storeMasterKey can export it
    const masterKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt'
    ]);

    storeMasterKey(masterKey);

    // storeMasterKey uses .then() internally, so we need to wait for it
    await new Promise((resolve) => setTimeout(resolve, 50));

    const loaded = await loadMasterKey();
    expect(loaded).not.toBeNull();
    expect(loaded!.type).toBe('secret');
    expect(loaded!.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });

    // Verify the loaded key can actually encrypt/decrypt
    const testData = new TextEncoder().encode('test');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, loaded!, testData);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, encrypted);
    expect(new Uint8Array(decrypted)).toEqual(testData);
  });

  it('clearMasterKey: after clear, loadMasterKey returns null', async () => {
    const masterKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt'
    ]);

    storeMasterKey(masterKey);
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Verify key is stored
    const loaded = await loadMasterKey();
    expect(loaded).not.toBeNull();

    // Clear and verify
    clearMasterKey();
    const afterClear = await loadMasterKey();
    expect(afterClear).toBeNull();
  });
});
