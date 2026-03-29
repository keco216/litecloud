import { error, json } from '@sveltejs/kit';
import { createBackup, rotateBackups, listBackups, deleteBackup } from '$lib/server/backup';
import type { RequestHandler } from './$types';

// GET: list all backups
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	return json({ backups: listBackups() });
};

// POST: trigger manual backup
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const { type } = await request.json().catch(() => ({ type: 'daily' }));
	const backup = createBackup(type === 'weekly' ? 'weekly' : 'daily');
	rotateBackups();
	return json({ backup });
};

// DELETE: remove a specific backup
export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	const { name } = await request.json();
	if (!name) error(400, 'Backup name required');
	const ok = deleteBackup(name);
	if (!ok) error(404, 'Backup not found');
	return json({ ok: true });
};
