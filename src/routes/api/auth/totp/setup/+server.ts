import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const secret = new OTPAuth.Secret({ size: 20 });

	const totp = new OTPAuth.TOTP({
		issuer: 'LiteCloud',
		label: locals.user.email,
		algorithm: 'SHA1',
		digits: 6,
		period: 30,
		secret
	});

	const uri = totp.toString();
	const qr = await QRCode.toDataURL(uri);

	// Store secret but don't enable yet (user must verify first)
	db.update(users)
		.set({ totpSecret: secret.base32 })
		.where(eq(users.id, locals.user.id))
		.run();

	return json({ qr, secret: secret.base32, uri });
};
