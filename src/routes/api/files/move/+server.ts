import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const { ids, targetPath } = await request.json();
	if (!ids?.length || targetPath === undefined) error(400, 'ids and targetPath are required');

	// Verify target folder exists (unless moving to root)
	if (targetPath !== '/') {
		const parts = targetPath.split('/').filter(Boolean);
		const folderName = parts.pop()!;
		const parentPath = '/' + parts.join('/') || '/';
		const folder = db
			.select()
			.from(files)
			.where(and(eq(files.userId, locals.user.id), eq(files.name, folderName), eq(files.path, parentPath), eq(files.isFolder, true)))
			.get();
		if (!folder) error(404, 'Target folder not found');
	}

	const now = new Date();
	let moved = 0;

	for (const id of ids) {
		const file = db
			.select()
			.from(files)
			.where(and(eq(files.id, id), eq(files.userId, locals.user.id)))
			.get();
		if (!file) continue;

		// Don't move a folder into itself
		if (file.isFolder) {
			const fileFolderPath = file.path === '/' ? `/${file.name}` : `${file.path}/${file.name}`;
			if (targetPath === fileFolderPath || targetPath.startsWith(fileFolderPath + '/')) continue;
		}

		// Update file path
		db.update(files).set({ path: targetPath, updatedAt: now }).where(eq(files.id, id)).run();

		// If it's a folder, update all children's paths too
		if (file.isFolder) {
			const oldFolderPath = file.path === '/' ? `/${file.name}` : `${file.path}/${file.name}`;
			const newFolderPath = targetPath === '/' ? `/${file.name}` : `${targetPath}/${file.name}`;

			const children = db
				.select()
				.from(files)
				.where(eq(files.userId, locals.user.id))
				.all()
				.filter((f) => f.path === oldFolderPath || f.path.startsWith(oldFolderPath + '/'));

			for (const child of children) {
				const updatedPath = newFolderPath + child.path.slice(oldFolderPath.length);
				db.update(files).set({ path: updatedPath, updatedAt: now }).where(eq(files.id, child.id)).run();
			}
		}

		moved++;
	}

	return json({ ok: true, moved });
};
