import { fail, redirect } from '@sveltejs/kit';
import { verifyCredentials, createSession } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, '/files');
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString().trim();
		const password = data.get('password')?.toString();

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.', email });
		}

		const user = await verifyCredentials(email, password);
		if (!user) {
			return fail(401, { error: 'Invalid email or password.', email });
		}

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

			// SECURITY: Never return password. Client retains it in memory.
			// Don't return encryption metadata before TOTP verification.
			return {
				unlockEncryption: false,
				needsTotp: true,
				email
			};
		}

		createSession(user.id, cookies);

		// SECURITY: Never return password — client keeps it from the form.
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
