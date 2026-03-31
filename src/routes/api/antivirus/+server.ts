import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getStatus } from '$lib/server/antivirus';
import { scanPendingFiles } from '$lib/server/scan-queue';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401);

	const status = await getStatus();

	const stats = db
		.select({ scanStatus: files.scanStatus, count: sql<number>`count(*)` })
		.from(files)
		.where(and(eq(files.userId, locals.user.id), eq(files.isFolder, false)))
		.groupBy(files.scanStatus)
		.all();

	const counts: Record<string, number> = { pending: 0, clean: 0, infected: 0, error: 0, skipped: 0 };
	for (const s of stats) {
		if (s.scanStatus) counts[s.scanStatus] = s.count;
	}

	return json({
		status,
		stats: {
			scanned: counts.clean + counts.infected,
			clean: counts.clean,
			infected: counts.infected,
			pending: counts.pending,
			skipped: counts.skipped,
			errors: counts.error
		}
	});
};

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401);
	const result = await scanPendingFiles();
	return json({ ok: true, ...result });
};
