import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files, users, shares, fileMetadata, fileTags } from '$lib/server/db/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { deleteFile as removeFile } from '$lib/server/storage';
import { removeFromIndex } from '$lib/server/search';
import { deleteThumbnails } from '$lib/server/thumbnails';
import { deleteAllVersions } from '$lib/server/versions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const trashed = db
		.select()
		.from(files)
		.where(and(eq(files.userId, locals.user.id), isNotNull(files.deletedAt)))
		.all();

	const now = Date.now();
	const items = trashed
		.map((f) => ({
			id: f.id,
			name: f.name,
			path: f.path,
			mimeType: f.mimeType,
			size: f.size,
			isFolder: f.isFolder,
			deletedAt: f.deletedAt,
			daysLeft: Math.max(0, 30 - Math.floor((now - new Date(f.deletedAt!).getTime()) / 86400000))
		}))
		.sort((a, b) => new Date(b.deletedAt!).getTime() - new Date(a.deletedAt!).getTime());

	return json({ items });
};

async function purgeFiles(userId: string, ids: string[]): Promise<number> {
	const toPurge = db
		.select()
		.from(files)
		.where(and(inArray(files.id, ids), eq(files.userId, userId), isNotNull(files.deletedAt)))
		.all();

	if (toPurge.length === 0) return 0;

	const fileIds = toPurge.map((f) => f.id);
	db.delete(shares).where(inArray(shares.fileId, fileIds)).run();
	db.delete(fileTags).where(inArray(fileTags.fileId, fileIds)).run();
	db.delete(fileMetadata).where(inArray(fileMetadata.fileId, fileIds)).run();

	let freedBytes = 0;
	for (const file of toPurge) {
		if (!file.isFolder) {
			await removeFile(userId, file.id);
			await deleteThumbnails(userId, file.id);
			const versionBytes = await deleteAllVersions(userId, file.id);
			freedBytes += file.size + versionBytes;
		}
		removeFromIndex(file.id);
		db.delete(files).where(eq(files.id, file.id)).run();
	}

	if (freedBytes > 0) {
		const current = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, userId)).get();
		const newUsed = Math.max(0, (current?.used || 0) - freedBytes);
		db.update(users).set({ storageUsed: newUsed }).where(eq(users.id, userId)).run();
	}

	return toPurge.length;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const body = await request.json().catch(() => ({}));
	const { action, ids } = body as { action: string; ids?: string[] };

	if (action === 'restore') {
		if (!ids?.length) error(400, 'No ids provided');
		db.update(files)
			.set({ deletedAt: null, deletedBy: null })
			.where(and(inArray(files.id, ids), eq(files.userId, locals.user.id), isNotNull(files.deletedAt)))
			.run();
		return json({ restored: ids.length });
	}

	if (action === 'purge') {
		if (!ids?.length) error(400, 'No ids provided');
		const count = await purgeFiles(locals.user.id, ids);
		return json({ purged: count });
	}

	if (action === 'empty') {
		const all = db
			.select({ id: files.id })
			.from(files)
			.where(and(eq(files.userId, locals.user.id), isNotNull(files.deletedAt)))
			.all();
		const count = await purgeFiles(locals.user.id, all.map((f) => f.id));
		return json({ purged: count });
	}

	error(400, 'Invalid action');
};
