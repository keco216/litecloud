import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { shares, files } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getFileStream } from '$lib/server/storage';
import { Readable } from 'node:stream';
import bcrypt from 'bcrypt';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const share = db
		.select()
		.from(shares)
		.where(eq(shares.token, params.token))
		.get();

	if (!share) error(404, 'Share link not found');

	// Check expiry
	if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
		error(410, 'This share link has expired');
	}

	// Check download limit
	if (share.maxDownloads && (share.downloadCount ?? 0) >= share.maxDownloads) {
		error(410, 'Download limit reached');
	}

	// Check password
	if (share.password) {
		const pw = url.searchParams.get('password');
		if (!pw) error(403, 'Password required');
		const valid = await bcrypt.compare(pw, share.password);
		if (!valid) error(403, 'Invalid password');
	}

	const file = db.select().from(files).where(eq(files.id, share.fileId)).get();
	if (!file) error(404, 'File not found');

	// Increment download count
	db.update(shares)
		.set({ downloadCount: (share.downloadCount ?? 0) + 1 })
		.where(eq(shares.id, share.id))
		.run();

	const nodeStream = getFileStream(file.userId, file.id, file.name);
	const webStream = Readable.toWeb(nodeStream) as ReadableStream;

	return new Response(webStream, {
		headers: {
			'Content-Type': file.mimeType || 'application/octet-stream',
			'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
			'Content-Length': String(file.size)
		}
	});
};
