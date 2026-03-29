import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const { name, path } = await request.json();
	if (!name?.trim()) error(400, 'Folder name is required');

	const targetPath = path || '/';
	const folderName = name.trim();

	// Check for duplicate
	const existing = db
		.select()
		.from(files)
		.where(
			and(
				eq(files.userId, locals.user.id),
				eq(files.path, targetPath),
				eq(files.name, folderName),
				eq(files.isFolder, true)
			)
		)
		.get();

	if (existing) error(409, 'A folder with this name already exists');

	const id = nanoid();
	const now = new Date();

	db.insert(files)
		.values({
			id,
			userId: locals.user.id,
			name: folderName,
			path: targetPath,
			mimeType: null,
			size: 0,
			isFolder: true,
			createdAt: now,
			updatedAt: now
		})
		.run();

	return json({ folder: { id, name: folderName, path: targetPath } });
};
