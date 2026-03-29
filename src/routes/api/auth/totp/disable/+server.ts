import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	db.update(users)
		.set({ totpEnabled: false, totpSecret: null })
		.where(eq(users.id, locals.user.id))
		.run();

	return json({ ok: true });
};
