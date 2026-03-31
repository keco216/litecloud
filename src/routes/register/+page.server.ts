import { fail, redirect } from '@sveltejs/kit';
import { createUser, createSession } from '$lib/server/auth';
import { registerLimiter } from '$lib/server/ratelimit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) redirect(302, '/files');
};

export const actions: Actions = {
	default: async ({ request, cookies, getClientAddress }) => {
		const data = await request.formData();
		const email = data.get('email')?.toString().trim();
		const password = data.get('password')?.toString();
		const confirm = data.get('confirm')?.toString();

		if (!email || !password || !confirm) {
			return fail(400, { error: 'All fields are required.', email });
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters.', email });
		}

		if (password !== confirm) {
			return fail(400, { error: 'Passwords do not match.', email });
		}

		const ip = getClientAddress();
		const regKey = `register:${ip}`;
		const limit = registerLimiter.check(regKey);

		if (!limit.allowed) {
			return fail(429, { error: 'Too many registration attempts. Please try again later.', email });
		}

		try {
			const user = await createUser(email, password);
			createSession(user.id, cookies);
		} catch (e: any) {
			if (e?.message?.includes('UNIQUE constraint')) {
				return fail(409, { error: 'An account with this email already exists.', email });
			}
			throw e;
		}

		return { setupEncryption: true };
	}
};
