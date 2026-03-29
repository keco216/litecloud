import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { shares, files } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const userShares = db
		.select({
			id: shares.id,
			token: shares.token,
			fileId: shares.fileId,
			fileName: files.name,
			fileSize: files.size,
			fileMimeType: files.mimeType,
			hasPassword: shares.password,
			expiresAt: shares.expiresAt,
			downloadCount: shares.downloadCount,
			maxDownloads: shares.maxDownloads,
			createdAt: shares.createdAt
		})
		.from(shares)
		.innerJoin(files, eq(shares.fileId, files.id))
		.where(eq(shares.userId, locals.user.id))
		.all();

	const result = userShares.map((s) => ({
		...s,
		hasPassword: !!s.hasPassword,
		expired: s.expiresAt ? new Date(s.expiresAt) < new Date() : false,
		exhausted: s.maxDownloads ? (s.downloadCount ?? 0) >= s.maxDownloads : false
	}));

	return json({ shares: result });
};
