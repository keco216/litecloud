import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { rename as fsRename } from 'node:fs/promises';
import { join } from 'node:path';
import type { RequestHandler } from './$types';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || './data/uploads';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const { id, name } = await request.json();
	if (!id || !name?.trim()) error(400, 'File id and new name are required');

	const newName = name.trim();

	// SECURITY: reject path traversal in filenames
	if (newName.includes('/') || newName.includes('\\') || newName.includes('..') || newName.includes('\0')) {
		error(400, 'Invalid file name');
	}

	const file = db
		.select()
		.from(files)
		.where(and(eq(files.id, id), eq(files.userId, locals.user.id)))
		.get();

	if (!file) error(404, 'File not found');

	// Rename on disk if it's a real file
	if (!file.isFolder) {
		const oldPath = join(UPLOAD_ROOT, locals.user.id, file.id, file.name);
		const newPath = join(UPLOAD_ROOT, locals.user.id, file.id, newName);
		try {
			await fsRename(oldPath, newPath);
		} catch {
			// File might not exist on disk yet, ignore
		}
	}

	// If renaming a folder, update all children's paths
	if (file.isFolder) {
		const oldFolderPath = file.path === '/' ? `/${file.name}` : `${file.path}/${file.name}`;
		const newFolderPath = file.path === '/' ? `/${newName}` : `${file.path}/${newName}`;

		// Update all files whose path starts with the old folder path
		const children = db
			.select()
			.from(files)
			.where(eq(files.userId, locals.user.id))
			.all()
			.filter((f) => f.path === oldFolderPath || f.path.startsWith(oldFolderPath + '/'));

		for (const child of children) {
			const updatedPath = newFolderPath + child.path.slice(oldFolderPath.length);
			db.update(files).set({ path: updatedPath, updatedAt: new Date() }).where(eq(files.id, child.id)).run();
		}
	}

	db.update(files).set({ name: newName, updatedAt: new Date() }).where(eq(files.id, id)).run();

	return json({ ok: true });
};
