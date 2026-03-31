import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { fileTags, files, tags } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);

	const { fileIds, tagId } = (await request.json()) as { fileIds: string[]; tagId: string };
	if (!fileIds?.length || !tagId) error(400);

	// Verify tag belongs to user
	const tag = db.select().from(tags).where(and(eq(tags.id, tagId), eq(tags.userId, locals.user.id))).get();
	if (!tag) error(404, 'Tag not found');

	const now = new Date();
	for (const fileId of fileIds) {
		// Verify file belongs to user
		const file = db.select({ id: files.id }).from(files).where(and(eq(files.id, fileId), eq(files.userId, locals.user.id))).get();
		if (!file) continue;

		// INSERT OR IGNORE (unique constraint on file_id + tag_id)
		try {
			db.insert(fileTags).values({ id: nanoid(), fileId, tagId, createdAt: now }).run();
		} catch {
			// Already exists — ignore
		}
	}

	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);

	const { fileIds, tagId } = (await request.json()) as { fileIds: string[]; tagId: string };
	if (!fileIds?.length || !tagId) error(400);

	// Verify tag belongs to user
	const tag = db.select().from(tags).where(and(eq(tags.id, tagId), eq(tags.userId, locals.user.id))).get();
	if (!tag) error(404, 'Tag not found');

	// Only remove associations for files owned by the user
	const ownedFileIds = fileIds.filter((fid) => {
		const f = db.select({ id: files.id }).from(files).where(and(eq(files.id, fid), eq(files.userId, locals.user.id))).get();
		return !!f;
	});

	if (ownedFileIds.length > 0) {
		db.delete(fileTags)
			.where(and(inArray(fileTags.fileId, ownedFileIds), eq(fileTags.tagId, tagId)))
			.run();
	}

	return json({ ok: true });
};
