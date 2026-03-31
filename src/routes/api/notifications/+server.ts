import { error, json } from '@sveltejs/kit';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '$lib/server/notifications';
import { db } from '$lib/server/db';
import { notifications } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) error(401);

	const countOnly = url.searchParams.has('count');
	if (countOnly) {
		return json({ count: getUnreadCount(locals.user.id) });
	}

	const items = getNotifications(locals.user.id);
	return json({ notifications: items, unreadCount: getUnreadCount(locals.user.id) });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);

	const body = await request.json();

	if (body.markAll) {
		markAllAsRead(locals.user.id);
		return json({ ok: true });
	}

	if (body.id) {
		markAsRead(locals.user.id, body.id);
		return json({ ok: true });
	}

	error(400, 'Invalid request');
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401);

	const { id } = await request.json();
	if (!id) error(400);

	db.delete(notifications)
		.where(and(eq(notifications.id, id), eq(notifications.userId, locals.user.id)))
		.run();

	return json({ ok: true });
};
