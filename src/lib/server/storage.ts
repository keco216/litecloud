import { mkdir, rm, stat } from 'node:fs/promises';
import { createReadStream, type ReadStream } from 'node:fs';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || './data/uploads';

export async function saveFile(
	userId: string,
	fileId: string,
	filename: string,
	data: ArrayBuffer
): Promise<string> {
	const dir = join(UPLOAD_ROOT, userId, fileId);
	await mkdir(dir, { recursive: true });
	const filePath = join(dir, filename);
	await writeFile(filePath, Buffer.from(data));
	return filePath;
}

export function getFileStream(userId: string, fileId: string, filename: string): ReadStream {
	return createReadStream(join(UPLOAD_ROOT, userId, fileId, filename));
}

export async function deleteFile(userId: string, fileId: string): Promise<void> {
	await rm(join(UPLOAD_ROOT, userId, fileId), { recursive: true, force: true });
}

export async function getFileSize(userId: string, fileId: string, filename: string): Promise<number> {
	const s = await stat(join(UPLOAD_ROOT, userId, fileId, filename));
	return s.size;
}
