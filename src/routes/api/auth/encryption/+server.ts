import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';

// GET: fetch encryption metadata for a user (by email, before full login)
export const GET: RequestHandler = async ({ url }) => {
	const email = url.searchParams.get('email');
	if (!email) error(400, 'Email required');

	const user = db
		.select({
			encryptionSalt: users.encryptionSalt,
			encryptedMasterKey: users.encryptedMasterKey,
			masterKeyIv: users.masterKeyIv,
			totpEnabled: users.totpEnabled
		})
		.from(users)
		.where(eq(users.email, email))
		.get();

	if (!user) error(404, 'User not found');

	return json({
		encryptionSalt: user.encryptionSalt,
		encryptedMasterKey: user.encryptedMasterKey,
		masterKeyIv: user.masterKeyIv,
		totpEnabled: user.totpEnabled ?? false
	});
};

// POST: store encryption metadata (called during register)
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const { encryptionSalt, encryptedMasterKey, masterKeyIv } = await request.json();

	if (!encryptionSalt || !encryptedMasterKey || !masterKeyIv) {
		error(400, 'Missing encryption fields');
	}

	db.update(users)
		.set({ encryptionSalt, encryptedMasterKey, masterKeyIv })
		.where(eq(users.id, locals.user.id))
		.run();

	return json({ ok: true });
};
