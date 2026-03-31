import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);

	const { ids, starred } = (await request.json()) as { ids: string[]; starred: boolean };
	if (!ids?.length) error(400);

	db.update(files)
		.set({ starred })
		.where(and(inArray(files.id, ids), eq(files.userId, locals.user.id)))
		.run();

	return json({ ok: true });
};
