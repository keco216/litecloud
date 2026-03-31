import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getStatus, isScannerAvailable } from '$lib/server/antivirus';
import { scanPendingFiles } from '$lib/server/scan-queue';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401);

	try {
		const status = await getStatus();

		let counts: Record<string, number> = { pending: 0, clean: 0, infected: 0, error: 0, skipped: 0 };
		try {
			const stats = db
				.select({ scanStatus: files.scanStatus, count: sql<number>`count(*)` })
				.from(files)
				.where(and(eq(files.userId, locals.user.id), eq(files.isFolder, false)))
				.groupBy(files.scanStatus)
				.all();

			for (const s of stats) {
				if (s.scanStatus) counts[s.scanStatus] = s.count;
			}
		} catch (dbErr) {
			console.error('[antivirus] Stats query failed:', dbErr);
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
	} catch (err: any) {
		console.error('[antivirus] GET /api/antivirus failed:', err.message);
		return json({
			status: { available: false, error: err.message || 'Unknown error' },
			stats: { scanned: 0, clean: 0, infected: 0, pending: 0, skipped: 0, errors: 0 }
		});
	}
};

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401);

	try {
		if (!isScannerAvailable()) {
			return json({ ok: false, error: 'ClamAV is not available', queued: 0 });
		}

		const result = await scanPendingFiles();
		return json({ ok: true, ...result });
	} catch (err: any) {
		console.error('[antivirus] POST /api/antivirus failed:', err.message);
		return json({ ok: false, error: err.message || 'Scan failed', queued: 0 });
	}
};
