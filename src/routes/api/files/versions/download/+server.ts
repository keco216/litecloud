import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files, fileVersions } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { RequestHandler } from './$types';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || './data/uploads';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) error(401);
	const fileId = url.searchParams.get('fileId');
	const versionId = url.searchParams.get('versionId');
	if (!fileId || !versionId) error(400);

	const file = db
		.select()
		.from(files)
		.where(and(eq(files.id, fileId), eq(files.userId, locals.user.id)))
		.get();
	if (!file) error(404);

	const version = db
		.select()
		.from(fileVersions)
		.where(and(eq(fileVersions.id, versionId), eq(fileVersions.fileId, fileId)))
		.get();
	if (!version) error(404);

	const versionPath = join(UPLOAD_ROOT, locals.user.id, fileId, '.versions', `v${version.versionNumber}_${file.name}`);
	const stream = createReadStream(versionPath);
	const webStream = Readable.toWeb(stream) as ReadableStream;

	return new Response(webStream, {
		headers: {
			'Content-Type': file.mimeType || 'application/octet-stream',
			'Content-Disposition': `attachment; filename="v${version.versionNumber}_${encodeURIComponent(file.name)}"`,
			'Content-Length': String(version.size)
		}
	});
};
