import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createSession } from '$lib/server/auth';
import * as OTPAuth from 'otpauth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	const { code, mode } = await request.json();
	if (!code) error(400, 'Code is required');

	// Two modes: "setup" (enabling 2FA) or "login" (verifying during login)
	if (mode === 'login') {
		const pendingUserId = cookies.get('pending_user');
		if (!pendingUserId) error(401, 'No pending login');

		const user = db.select().from(users).where(eq(users.id, pendingUserId)).get();
		if (!user || !user.totpSecret) error(401, 'Invalid state');

		const totp = new OTPAuth.TOTP({
			issuer: 'LiteCloud',
			algorithm: 'SHA1',
			digits: 6,
			period: 30,
			secret: OTPAuth.Secret.fromBase32(user.totpSecret)
		});

		const delta = totp.validate({ token: code, window: 1 });
		if (delta === null) error(401, 'Invalid code');

		// TOTP verified — create real session
		cookies.delete('pending_user', { path: '/' });
		createSession(user.id, cookies);

		return json({ ok: true });
	}

	// Setup mode — verify code to enable 2FA
	if (!locals.user) error(401, 'Unauthorized');

	const user = db.select().from(users).where(eq(users.id, locals.user.id)).get();
	if (!user || !user.totpSecret) error(400, 'TOTP not set up');

	const totp = new OTPAuth.TOTP({
		issuer: 'LiteCloud',
		algorithm: 'SHA1',
		digits: 6,
		period: 30,
		secret: OTPAuth.Secret.fromBase32(user.totpSecret)
	});

	const delta = totp.validate({ token: code, window: 1 });
	if (delta === null) error(401, 'Invalid code');

	db.update(users)
		.set({ totpEnabled: true })
		.where(eq(users.id, locals.user.id))
		.run();

	return json({ ok: true, enabled: true });
};
