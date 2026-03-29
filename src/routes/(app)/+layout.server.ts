import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');

	const user = db.select().from(users).where(eq(users.id, locals.user.id)).get();

	return {
		user: locals.user,
		storageUsed: user?.storageUsed ?? 0,
		storageQuota: user?.storageQuota ?? 1073741824
	};
};
