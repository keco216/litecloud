import { fail, redirect } from '@sveltejs/kit';
import { verifyCredentials, createSession } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { loginLimiter } from '$lib/server/ratelimit';
import { notifyNewLogin } from '$lib/server/notifications';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, '/files');
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString().trim();
		const password = data.get('password')?.toString();

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.', email });
		}

		const ip = getClientAddress();
		const loginKey = `login:${ip}`;
		const limit = loginLimiter.check(loginKey);

		if (!limit.allowed) {
			return fail(429, {
				error: `Too many login attempts.`,
				email,
				rateLimited: true,
				retryAfterMs: limit.retryAfterMs
			});
		}

		const user = await verifyCredentials(email, password);
		if (!user) {
			return fail(401, { error: 'Invalid email or password.', email });
		}

		// Success — reset limiter
		loginLimiter.reset(loginKey);
		notifyNewLogin(user.id, ip);

		// Fetch encryption + TOTP metadata
		const fullUser = db.select().from(users).where(eq(users.id, user.id)).get()!;

		if (fullUser.totpEnabled) {
			cookies.set('pending_user', user.id, {
				path: '/',
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				maxAge: 300
			});

			return {
				unlockEncryption: false,
				needsTotp: true,
				email
			};
		}

		createSession(user.id, cookies);

		return {
			unlockEncryption: true,
			needsTotp: false,
			email,
			encryptionSalt: fullUser.encryptionSalt || '',
			encryptedMasterKey: fullUser.encryptedMasterKey || '',
			masterKeyIv: fullUser.masterKeyIv || ''
		};
	}
};
