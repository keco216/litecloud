import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

function collectChildren(userId: string, folderPath: string) {
	const allFiles = db
		.select()
		.from(files)
		.where(and(eq(files.userId, userId), isNull(files.deletedAt)))
		.all();
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
		.where(and(inArray(files.id, ids), eq(files.userId, locals.user.id), isNull(files.deletedAt)))
		.all();

	const allToRemove = new Map<string, (typeof toDelete)[0]>();

	for (const file of toDelete) {
		allToRemove.set(file.id, file);
		if (file.isFolder) {
			const folderPath = file.path === '/' ? `/${file.name}` : `${file.path}/${file.name}`;
			for (const child of collectChildren(locals.user.id, folderPath)) {
				allToRemove.set(child.id, child);
			}
		}
	}

	const now = new Date();
	for (const id of allToRemove.keys()) {
		db.update(files)
			.set({ deletedAt: now, deletedBy: locals.user.id })
			.where(eq(files.id, id))
			.run();
	}

	return json({ deleted: allToRemove.size, ids: [...allToRemove.keys()] });
};
