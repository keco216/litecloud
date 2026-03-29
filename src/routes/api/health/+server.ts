import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		// Quick DB check
		const result = db.select({ count: sql<number>`count(*)` }).from(users).get();
		return json({
			status: 'ok',
			timestamp: new Date().toISOString(),
			db: 'connected',
			users: result?.count ?? 0
		});
	} catch (e) {
		return json({ status: 'error', error: 'Database unreachable' }, { status: 503 });
	}
};
