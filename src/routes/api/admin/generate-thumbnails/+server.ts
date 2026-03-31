import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { generateAllThumbnails } from '$lib/server/thumbnails';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const images = db
		.select({ id: files.id, name: files.name, userId: files.userId, mimeType: files.mimeType, encrypted: files.encrypted })
		.from(files)
		.where(and(eq(files.userId, locals.user.id), eq(files.isFolder, false), isNull(files.deletedAt)))
		.all()
		.filter((f) => f.mimeType?.startsWith('image/') && !f.encrypted);

	let processed = 0;
	let failed = 0;

	for (const img of images) {
		try {
			await generateAllThumbnails(img.userId, img.id, img.name);
			processed++;
		} catch {
			failed++;
		}
	}

	return json({ processed, failed, total: images.length });
};
