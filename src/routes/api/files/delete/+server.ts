import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files, users, shares, fileMetadata } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { deleteFile as removeFile } from '$lib/server/storage';
import { removeFromIndex } from '$lib/server/search';
import type { RequestHandler } from './$types';

function collectChildren(userId: string, folderPath: string): typeof allFiles {
	const allFiles = db.select().from(files).where(eq(files.userId, userId)).all();
	return allFiles.filter((f) => f.path === folderPath || f.path.startsWith(folderPath + '/'));
}

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const body = await request.json().catch(() => ({}));

	const ids: string[] = body.ids;
	if (!ids?.length) error(400, 'No file ids provided');

	const toDelete = db
		.select()
		.from(files)
		.where(and(inArray(files.id, ids), eq(files.userId, locals.user.id)))
		.all();

	let freedBytes = 0;
	const allToRemove = new Map<string, (typeof toDelete)[0]>();

	// Collect folders' children recursively
	for (const file of toDelete) {
		allToRemove.set(file.id, file);
		if (file.isFolder) {
			const folderPath = file.path === '/' ? `/${file.name}` : `${file.path}/${file.name}`;
			for (const child of collectChildren(locals.user.id, folderPath)) {
				allToRemove.set(child.id, child);
			}
		}
	}

	const fileIds = [...allToRemove.keys()];

	// Delete shares referencing these files first (FK constraint)
	if (fileIds.length > 0) {
		db.delete(shares).where(inArray(shares.fileId, fileIds)).run();
	}

	for (const file of allToRemove.values()) {
		if (!file.isFolder) {
			await removeFile(locals.user.id, file.id);
			freedBytes += file.size;
		}
		removeFromIndex(file.id);
		db.delete(fileMetadata).where(eq(fileMetadata.fileId, file.id)).run();
		db.delete(files).where(eq(files.id, file.id)).run();
	}

	if (freedBytes > 0) {
		const current = db
			.select({ used: users.storageUsed })
			.from(users)
			.where(eq(users.id, locals.user.id))
			.get();
		const newUsed = Math.max(0, (current?.used || 0) - freedBytes);
		db.update(users).set({ storageUsed: newUsed }).where(eq(users.id, locals.user.id)).run();
	}

	return json({ deleted: allToRemove.size });
};
