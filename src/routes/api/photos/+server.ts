import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files, fileMetadata } from '$lib/server/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const photos = db
		.select({
			id: files.id,
			name: files.name,
			path: files.path,
			mimeType: files.mimeType,
			size: files.size,
			encrypted: files.encrypted,
			iv: files.iv,
			createdAt: files.createdAt,
			dateTaken: fileMetadata.dateTaken,
			latitude: fileMetadata.latitude,
			longitude: fileMetadata.longitude,
			camera: fileMetadata.camera,
			width: fileMetadata.width,
			height: fileMetadata.height
		})
		.from(files)
		.leftJoin(fileMetadata, eq(files.id, fileMetadata.fileId))
		.where(and(eq(files.userId, locals.user.id), eq(files.isFolder, false), isNull(files.deletedAt)))
		.all()
		.filter((f) => f.mimeType?.startsWith('image/'))
		.sort((a, b) => {
			const da = a.dateTaken || a.createdAt;
			const db2 = b.dateTaken || b.createdAt;
			return new Date(db2).getTime() - new Date(da).getTime();
		});

	// Group by month
	const groups: Record<string, typeof photos> = {};
	for (const photo of photos) {
		const d = new Date(photo.dateTaken || photo.createdAt);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		(groups[key] ??= []).push(photo);
	}

	return json({
		groups,
		totalCount: photos.length,
		totalSize: photos.reduce((sum, p) => sum + p.size, 0)
	});
};
