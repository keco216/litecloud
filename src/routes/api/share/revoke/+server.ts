import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { shares } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const { id } = await request.json();
	if (!id) error(400, 'Share id is required');

	const result = db
		.delete(shares)
		.where(and(eq(shares.id, id), eq(shares.userId, locals.user.id)))
		.run();

	return json({ deleted: result.changes });
};
