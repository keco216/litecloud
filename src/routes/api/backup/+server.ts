import { error, json } from '@sveltejs/kit';
import { createBackup, rotateBackups, listBackups, deleteBackup } from '$lib/server/backup';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { RequestHandler } from './$types';

/** Only the first registered user (admin) may manage backups */
function requireAdmin(userId: string) {
	const first = db.select({ id: users.id }).from(users).orderBy(users.createdAt).limit(1).get();
	if (!first || first.id !== userId) error(403, 'Admin access required');
}

// GET: list all backups
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	requireAdmin(locals.user.id);
	return json({ backups: listBackups() });
};

// POST: trigger manual backup
export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	requireAdmin(locals.user.id);
	const { type } = await request.json().catch(() => ({ type: 'daily' }));
	const backup = createBackup(type === 'weekly' ? 'weekly' : 'daily');
	rotateBackups();
	return json({ backup });
};

// DELETE: remove a specific backup
export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');
	requireAdmin(locals.user.id);
	const { name } = await request.json();
	if (!name) error(400, 'Backup name required');
	const ok = deleteBackup(name);
	if (!ok) error(404, 'Backup not found');
	return json({ ok: true });
};
