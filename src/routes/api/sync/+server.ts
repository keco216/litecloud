import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and, or, gt, isNotNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * GET /api/sync?since=1234567890
 *
 * Incremental sync: returns all files changed since the given Unix timestamp.
 * Includes deleted files (deletedAt set) so the client can mirror deletions.
 * Used by the desktop sync client for periodic sync checks.
 */
export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) error(401);

	const since = parseInt(url.searchParams.get('since') || '0', 10);
	const sinceDate = new Date(since * 1000);

	const changed = db
		.select({
			id: files.id,
			name: files.name,
			path: files.path,
			size: files.size,
			isFolder: files.isFolder,
			mimeType: files.mimeType,
			encrypted: files.encrypted,
			createdAt: files.createdAt,
			updatedAt: files.updatedAt,
			deletedAt: files.deletedAt
		})
		.from(files)
		.where(
			and(
				eq(files.userId, locals.user.id),
				or(
					gt(files.updatedAt, sinceDate),
					gt(files.createdAt, sinceDate),
					and(isNotNull(files.deletedAt), gt(files.deletedAt, sinceDate))
				)
			)
		)
		.all();

	return json({
		files: changed.map((f) => ({
			...f,
			createdAt: Math.floor(new Date(f.createdAt).getTime() / 1000),
			updatedAt: Math.floor(new Date(f.updatedAt).getTime() / 1000),
			deletedAt: f.deletedAt ? Math.floor(new Date(f.deletedAt).getTime() / 1000) : null
		})),
		serverTime: Math.floor(Date.now() / 1000),
		totalFiles: changed.length
	});
};
