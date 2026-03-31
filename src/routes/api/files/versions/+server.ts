import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { listVersions, restoreVersion } from '$lib/server/versions';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) error(401);
	const fileId = url.searchParams.get('id');
	if (!fileId) error(400, 'File ID required');

	const file = db
		.select()
		.from(files)
		.where(and(eq(files.id, fileId), eq(files.userId, locals.user.id)))
		.get();
	if (!file) error(404);

	const versions = listVersions(fileId);
	return json({ versions, currentSize: file.size, currentUpdatedAt: file.updatedAt });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);
	const { fileId, versionId } = await request.json();
	if (!fileId || !versionId) error(400);

	const file = db
		.select()
		.from(files)
		.where(and(eq(files.id, fileId), eq(files.userId, locals.user.id)))
		.get();
	if (!file) error(404);

	const ok = await restoreVersion(locals.user.id, fileId, versionId, file.name);
	if (!ok) error(404, 'Version not found');

	return json({ ok: true });
};
