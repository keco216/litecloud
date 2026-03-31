import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { tags, fileTags } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { RequestHandler } from './$types';

const DEFAULT_TAGS = [
	{ name: 'Important', color: '#ef4444' },
	{ name: 'Work', color: '#3b82f6' },
	{ name: 'Personal', color: '#22c55e' },
	{ name: 'Archive', color: '#f59e0b' }
];

function ensureDefaultTags(userId: string) {
	const existing = db.select().from(tags).where(eq(tags.userId, userId)).all();
	if (existing.length > 0) return;

	const now = new Date();
	for (const t of DEFAULT_TAGS) {
		db.insert(tags).values({ id: nanoid(), userId, name: t.name, color: t.color, createdAt: now }).run();
	}
}

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401);

	ensureDefaultTags(locals.user.id);

	const userTags = db.select().from(tags).where(eq(tags.userId, locals.user.id)).all();

	// Count files per tag
	const result = userTags.map((tag) => {
		const count = db
			.select({ count: sql<number>`count(*)` })
			.from(fileTags)
			.where(eq(fileTags.tagId, tag.id))
			.get();
		return { ...tag, fileCount: count?.count ?? 0 };
	});

	return json({ tags: result });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);

	const { name, color } = (await request.json()) as { name: string; color?: string };
	if (!name?.trim()) error(400, 'Tag name required');

	const id = nanoid();
	db.insert(tags)
		.values({ id, userId: locals.user.id, name: name.trim(), color: color || '#9ca3af', createdAt: new Date() })
		.run();

	return json({ id, name: name.trim(), color: color || '#9ca3af' });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);

	const { id } = (await request.json()) as { id: string };
	if (!id) error(400);

	// Remove all file_tags for this tag first
	db.delete(fileTags).where(eq(fileTags.tagId, id)).run();
	db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, locals.user.id))).run();

	return json({ ok: true });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);

	const { id, name, color } = (await request.json()) as { id: string; name?: string; color?: string };
	if (!id) error(400);

	const updates: Record<string, unknown> = {};
	if (name?.trim()) updates.name = name.trim();
	if (color) updates.color = color;

	if (Object.keys(updates).length > 0) {
		db.update(tags).set(updates).where(and(eq(tags.id, id), eq(tags.userId, locals.user.id))).run();
	}

	return json({ ok: true });
};
