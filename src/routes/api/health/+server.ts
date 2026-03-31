import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import { loginLimiter, apiLimiter, shareLimiter } from '$lib/server/ratelimit';
import { getStatus } from '$lib/server/antivirus';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const result = db.select({ count: sql<number>`count(*)` }).from(users).get();
		const avStatus = await getStatus();
		return json({
			status: 'ok',
			timestamp: new Date().toISOString(),
			db: 'connected',
			users: result?.count ?? 0,
			antivirus: { available: avStatus.available, version: avStatus.version || null },
			rateLimiters: {
				login: loginLimiter.getStats(),
				api: apiLimiter.getStats(),
				share: shareLimiter.getStats()
			}
		});
	} catch (e) {
		return json({ status: 'error', error: 'Database unreachable' }, { status: 503 });
	}
};
