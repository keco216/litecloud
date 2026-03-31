import { db } from './db';
import { notifications, users } from './db/schema';
import { eq, and, desc, lt, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

type NotificationType = 'storage_warning' | 'backup_complete' | 'share_download' | 'new_login' | 'system';

function iconForType(type: NotificationType): string {
	const icons: Record<NotificationType, string> = {
		storage_warning: 'warning',
		backup_complete: 'backup',
		share_download: 'download',
		new_login: 'security',
		system: 'info'
	};
	return icons[type] || 'notifications';
}

export function createNotification(params: {
	userId: string;
	type: NotificationType;
	title: string;
	body?: string;
	icon?: string;
	actionUrl?: string;
}): void {
	db.insert(notifications)
		.values({
			id: nanoid(),
			userId: params.userId,
			type: params.type,
			title: params.title,
			body: params.body || null,
			icon: params.icon || iconForType(params.type as NotificationType),
			actionUrl: params.actionUrl || null,
			createdAt: new Date()
		})
		.run();
}

export function getNotifications(userId: string, limit = 20) {
	return db
		.select()
		.from(notifications)
		.where(eq(notifications.userId, userId))
		.orderBy(desc(notifications.createdAt))
		.limit(limit)
		.all();
}

export function getUnreadCount(userId: string): number {
	const result = db
		.select({ count: sql<number>`count(*)` })
		.from(notifications)
		.where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
		.get();
	return result?.count ?? 0;
}

export function markAsRead(userId: string, notificationId: string): void {
	db.update(notifications)
		.set({ read: true })
		.where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
		.run();
}

export function markAllAsRead(userId: string): void {
	db.update(notifications)
		.set({ read: true })
		.where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
		.run();
}

export function deleteOldNotifications(): void {
	const cutoff = new Date(Date.now() - 30 * 86400000);
	db.delete(notifications).where(lt(notifications.createdAt, cutoff)).run();
}

// ── Convenience ──

export function notifyStorageWarning(userId: string, usedPct: number): void {
	const recent = db
		.select()
		.from(notifications)
		.where(and(eq(notifications.userId, userId), eq(notifications.type, 'storage_warning')))
		.orderBy(desc(notifications.createdAt))
		.limit(1)
		.get();

	if (recent) {
		const hoursSince = (Date.now() - new Date(recent.createdAt).getTime()) / 3600000;
		if (hoursSince < 24) return;
	}

	createNotification({
		userId,
		type: 'storage_warning',
		title: usedPct >= 95 ? 'Storage almost full' : 'Storage running low',
		body: `You've used ${usedPct}% of your storage quota.`,
		actionUrl: '/storage'
	});
}

export function notifyBackupComplete(userId: string, backupName: string): void {
	createNotification({
		userId,
		type: 'backup_complete',
		title: 'Backup complete',
		body: `Backup "${backupName}" created successfully.`,
		actionUrl: '/settings'
	});
}

export function notifyShareDownload(userId: string, fileName: string, downloadCount: number): void {
	if (downloadCount > 5) return; // Don't spam for popular links
	createNotification({
		userId,
		type: 'share_download',
		title: 'File downloaded via share link',
		body: `"${fileName}" was downloaded (${downloadCount} total).`,
		actionUrl: '/shares'
	});
}

export function notifyNewLogin(userId: string, ip: string): void {
	createNotification({
		userId,
		type: 'new_login',
		title: 'New sign-in',
		body: `New login from IP ${ip}.`
	});
}
