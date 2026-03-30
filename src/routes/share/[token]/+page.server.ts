import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { shares, files } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const share = db.select().from(shares).where(eq(shares.token, params.token)).get();
	if (!share) error(404, 'Share link not found');

	const file = db.select().from(files).where(eq(files.id, share.fileId)).get();
	if (!file) error(404, 'File not found');

	const expired = share.expiresAt ? new Date(share.expiresAt) < new Date() : false;
	const exhausted = share.maxDownloads ? (share.downloadCount ?? 0) >= share.maxDownloads : false;
	const isFolder = file.isFolder ?? false;

	// For folders, count total items and size
	let folderItemCount = 0;
	let folderTotalSize = 0;
	if (isFolder) {
		const folderFullPath =
			file.path === '/' ? `/${file.name}` : `${file.path}/${file.name}`;
		const allUserFiles = db.select().from(files).where(eq(files.userId, file.userId)).all();
		const children = allUserFiles.filter(
			(f) => f.path === folderFullPath || f.path.startsWith(folderFullPath + '/')
		);
		folderItemCount = children.length;
		folderTotalSize = children.reduce((sum, f) => sum + (f.isFolder ? 0 : f.size), 0);
	}

	return {
		token: share.token,
		fileName: file.name,
		fileSize: file.size,
		fileMimeType: file.mimeType,
		isFolder,
		folderItemCount,
		folderTotalSize,
		hasPassword: !!share.password,
		expired,
		exhausted,
		expiresAt: share.expiresAt ? new Date(share.expiresAt).toISOString() : null,
		downloadCount: share.downloadCount ?? 0,
		maxDownloads: share.maxDownloads
	};
};
