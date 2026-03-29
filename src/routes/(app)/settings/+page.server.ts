import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = db.select().from(users).where(eq(users.id, locals.user!.id)).get()!;
	return {
		totpEnabled: user.totpEnabled ?? false,
		hasEncryption: !!user.encryptionSalt
	};
};
