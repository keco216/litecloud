import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { generateThumbnail, getThumbStream, thumbnailExists } from '$lib/server/thumbnails';
import { Readable } from 'node:stream';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) error(401);

	const fileId = url.searchParams.get('id');
	const size = (url.searchParams.get('size') || 'sm') as 'sm' | 'md' | 'lg';
	if (!fileId) error(400, 'Missing file id');

	const file = db
		.select()
		.from(files)
		.where(and(eq(files.id, fileId), eq(files.userId, locals.user.id), isNull(files.deletedAt)))
		.get();

	if (!file || file.isFolder || file.encrypted) error(404);
	if (!file.mimeType?.startsWith('image/')) error(400, 'Not an image');

	const exists = await thumbnailExists(locals.user.id, fileId, size);
	if (!exists) {
		try {
			await generateThumbnail(locals.user.id, fileId, file.name, size);
		} catch {
			error(500, 'Failed to generate thumbnail');
		}
	}

	const stream = getThumbStream(locals.user.id, fileId, size);
	const webStream = Readable.toWeb(stream) as ReadableStream;

	return new Response(webStream, {
		headers: {
			'Content-Type': 'image/webp',
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
