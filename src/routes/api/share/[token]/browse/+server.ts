import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { shares, files } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const share = db.select().from(shares).where(eq(shares.token, params.token)).get();
	if (!share) error(404, 'Share link not found');

	if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
		error(410, 'This share link has expired');
	}
	if (share.maxDownloads && (share.downloadCount ?? 0) >= share.maxDownloads) {
		error(410, 'Download limit reached');
	}

	if (share.password) {
		const pw = url.searchParams.get('password');
		if (!pw) error(403, 'Password required');
		const valid = await bcrypt.compare(pw, share.password);
		if (!valid) error(403, 'Invalid password');
	}

	const sharedItem = db.select().from(files).where(eq(files.id, share.fileId)).get();
	if (!sharedItem || !sharedItem.isFolder) error(400, 'Not a shared folder');

	// Build the folder's full path
	const folderFullPath = sharedItem.path === '/' ? `/${sharedItem.name}` : `${sharedItem.path}/${sharedItem.name}`;

	// Get the subpath within the shared folder
	const subpath = url.searchParams.get('path') || '';
	const browsePath = subpath ? `${folderFullPath}/${subpath}`.replace(/\/+/g, '/') : folderFullPath;

	// Validate that browsePath is within the shared folder (prevent traversal)
	if (!browsePath.startsWith(folderFullPath)) {
		error(400, 'Invalid path');
	}

	const items = db
		.select({
			id: files.id,
			name: files.name,
			path: files.path,
			mimeType: files.mimeType,
			size: files.size,
			isFolder: files.isFolder,
			updatedAt: files.updatedAt
		})
		.from(files)
		.where(and(eq(files.userId, sharedItem.userId), eq(files.path, browsePath)))
		.all();

	// Sort: folders first, then by name
	items.sort((a, b) => {
		if (a.isFolder && !b.isFolder) return -1;
		if (!a.isFolder && b.isFolder) return 1;
		return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
	});

	return json({
		items: items.map((f) => ({
			id: f.id,
			name: f.name,
			mimeType: f.mimeType,
			size: f.size,
			isFolder: f.isFolder,
			updatedAt: f.updatedAt
		})),
		currentPath: subpath || ''
	});
};
