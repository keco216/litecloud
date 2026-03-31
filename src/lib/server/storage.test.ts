import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import type { ReadStream } from 'node:fs';

const TEST_UPLOAD_DIR = './data/test-uploads';

let storage: typeof import('./storage');

beforeAll(async () => {
	process.env.UPLOAD_DIR = TEST_UPLOAD_DIR;
	mkdirSync(TEST_UPLOAD_DIR, { recursive: true });
	storage = await import('./storage');
});

afterAll(() => {
	rmSync(TEST_UPLOAD_DIR, { recursive: true, force: true });
});

describe('storage', () => {
	const userId = 'user-1';
	const fileId = 'file-1';
	const filename = 'hello.txt';
	const contentStr = 'Hello, LiteCloud!';
	const content = new Uint8Array(Buffer.from(contentStr));

	describe('saveFile', () => {
		it('saves a file and content matches when read back', async () => {
			const filePath = await storage.saveFile(userId, fileId, filename, content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength));
			const readBack = readFileSync(filePath, 'utf-8');
			expect(readBack).toBe(contentStr);
		});

		it('handles an empty ArrayBuffer without crashing', async () => {
			const emptyBuf = new ArrayBuffer(0);
			const filePath = await storage.saveFile(userId, 'file-empty', 'empty.bin', emptyBuf);
			const readBack = readFileSync(filePath);
			expect(readBack.length).toBe(0);
		});
	});

	describe('getFileStream', () => {
		it('returns a readable stream with correct content', async () => {
			const ab = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
			await storage.saveFile(userId, fileId, filename, ab);

			const stream: ReadStream = storage.getFileStream(userId, fileId, filename);
			const chunks: Buffer[] = [];

			const collected = await new Promise<Buffer>((resolve, reject) => {
				stream.on('data', (chunk: Buffer) => chunks.push(chunk));
				stream.on('end', () => resolve(Buffer.concat(chunks)));
				stream.on('error', reject);
			});

			expect(collected.toString('utf-8')).toBe(contentStr);
		});
	});

	describe('deleteFile', () => {
		it('removes the file and its directory from disk', async () => {
			const delUserId = 'user-del';
			const delFileId = 'file-del';
			await storage.saveFile(delUserId, delFileId, 'to-delete.txt', content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength));

			await storage.deleteFile(delUserId, delFileId);

			const dirPath = `${TEST_UPLOAD_DIR}/${delUserId}/${delFileId}`;
			expect(existsSync(dirPath)).toBe(false);
		});

		it('does not throw for a non-existent file', async () => {
			await expect(
				storage.deleteFile('no-user', 'no-file')
			).resolves.toBeUndefined();
		});
	});

	describe('getFileSize', () => {
		it('returns the correct byte count', async () => {
			const sizeUserId = 'user-size';
			const sizeFileId = 'file-size';
			const sizeFilename = 'sized.txt';
			await storage.saveFile(sizeUserId, sizeFileId, sizeFilename, content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength));

			const size = await storage.getFileSize(sizeUserId, sizeFileId, sizeFilename);
			expect(size).toBe(content.byteLength);
		});
	});
});
