import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { shares, files } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const share = db.select().from(shares).where(eq(shares.token, params.token)).get();
	if (!share) error(404, 'Share link not found');

	const file = db.select().from(files).where(eq(files.id, share.fileId)).get();
	if (!file) error(404, 'File not found');

	const expired = share.expiresAt ? new Date(share.expiresAt) < new Date() : false;
	const exhausted = share.maxDownloads ? (share.downloadCount ?? 0) >= share.maxDownloads : false;

	return {
		token: share.token,
		fileName: file.name,
		fileSize: file.size,
		fileMimeType: file.mimeType,
		hasPassword: !!share.password,
		expired,
		exhausted,
		expiresAt: share.expiresAt ? new Date(share.expiresAt).toISOString() : null,
		downloadCount: share.downloadCount ?? 0,
		maxDownloads: share.maxDownloads
	};
};
