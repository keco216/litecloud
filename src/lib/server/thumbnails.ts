import sharp from 'sharp';
import { mkdir, access, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createReadStream } from 'node:fs';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || './data/uploads';

const THUMB_SIZES = {
	sm: { width: 200, height: 200 },
	md: { width: 400, height: 400 },
	lg: { width: 800, height: 800 }
} as const;

type ThumbSize = keyof typeof THUMB_SIZES;

export async function generateThumbnail(
	userId: string,
	fileId: string,
	fileName: string,
	size: ThumbSize = 'sm'
): Promise<string> {
	const thumbDir = join(UPLOAD_ROOT, userId, fileId, '.thumbs');
	const thumbPath = join(thumbDir, `${size}.webp`);

	try {
		await access(thumbPath);
		return thumbPath;
	} catch {}

	await mkdir(thumbDir, { recursive: true });
	const sourcePath = join(UPLOAD_ROOT, userId, fileId, fileName);
	const { width, height } = THUMB_SIZES[size];

	await sharp(sourcePath)
		.resize(width, height, { fit: 'cover', position: 'centre' })
		.webp({ quality: 80 })
		.toFile(thumbPath);

	return thumbPath;
}

export async function generateAllThumbnails(
	userId: string,
	fileId: string,
	fileName: string
): Promise<void> {
	await Promise.all(
		(Object.keys(THUMB_SIZES) as ThumbSize[]).map((size) =>
			generateThumbnail(userId, fileId, fileName, size).catch(() => {})
		)
	);
}

export function getThumbStream(userId: string, fileId: string, size: ThumbSize = 'sm') {
	const thumbPath = join(UPLOAD_ROOT, userId, fileId, '.thumbs', `${size}.webp`);
	return createReadStream(thumbPath);
}

export async function thumbnailExists(
	userId: string,
	fileId: string,
	size: ThumbSize = 'sm'
): Promise<boolean> {
	try {
		await access(join(UPLOAD_ROOT, userId, fileId, '.thumbs', `${size}.webp`));
		return true;
	} catch {
		return false;
	}
}

export async function deleteThumbnails(userId: string, fileId: string): Promise<void> {
	await rm(join(UPLOAD_ROOT, userId, fileId, '.thumbs'), { recursive: true, force: true });
}
