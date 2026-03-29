import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getFileStream } from '$lib/server/storage';
import { Readable } from 'node:stream';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const fileId = url.searchParams.get('id');
	if (!fileId) error(400, 'Missing file id');

	const file = db
		.select()
		.from(files)
		.where(and(eq(files.id, fileId), eq(files.userId, locals.user.id)))
		.get();

	if (!file) error(404, 'File not found');

	const nodeStream = getFileStream(locals.user.id, file.id, file.name);
	const webStream = Readable.toWeb(nodeStream) as ReadableStream;

	return new Response(webStream, {
		headers: {
			'Content-Type': file.mimeType || 'application/octet-stream',
			'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
			'Content-Length': String(file.size)
		}
	});
};
