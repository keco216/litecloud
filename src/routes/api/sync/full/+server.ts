import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

/**
 * GET /api/sync/full
 *
 * Full file list for initial sync. Returns all non-deleted files with
 * minimal payload (no content, no metadata). Used by the desktop sync
 * client on first connect or after a reset.
 */
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401);

	const allFiles = db
		.select({
			id: files.id,
			name: files.name,
			path: files.path,
			size: files.size,
			isFolder: files.isFolder,
			encrypted: files.encrypted,
			updatedAt: files.updatedAt
		})
		.from(files)
		.where(and(eq(files.userId, locals.user.id), isNull(files.deletedAt)))
		.all();

	return json({
		files: allFiles.map((f) => ({
			...f,
			updatedAt: Math.floor(new Date(f.updatedAt).getTime() / 1000)
		})),
		serverTime: Math.floor(Date.now() / 1000),
		totalFiles: allFiles.length
	});
};
