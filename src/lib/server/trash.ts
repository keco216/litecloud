import { db } from './db';
import { files, users, shares, fileMetadata } from './db/schema';
import { eq, and, isNotNull, lt, inArray } from 'drizzle-orm';
import { deleteFile as removeFile } from './storage';
import { removeFromIndex } from './search';
import { deleteThumbnails } from './thumbnails';
import { deleteAllVersions } from './versions';
import cron from 'node-cron';

const RETENTION_DAYS = 30;

export async function purgeExpiredTrash(): Promise<number> {
	const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);

	const expired = db
		.select()
		.from(files)
		.where(and(isNotNull(files.deletedAt), lt(files.deletedAt, cutoff)))
		.all();

	if (expired.length === 0) return 0;

	const fileIds = expired.map((f) => f.id);

	// Clean up references
	db.delete(shares).where(inArray(shares.fileId, fileIds)).run();
	db.delete(fileMetadata).where(inArray(fileMetadata.fileId, fileIds)).run();

	// Group by user to update storage
	const byUser = new Map<string, number>();

	for (const file of expired) {
		if (!file.isFolder) {
			try { await removeFile(file.userId, file.id); } catch {}
			try { await deleteThumbnails(file.userId, file.id); } catch {}
			try { const vb = await deleteAllVersions(file.userId, file.id); byUser.set(file.userId, (byUser.get(file.userId) || 0) + vb); } catch {}
			byUser.set(file.userId, (byUser.get(file.userId) || 0) + file.size);
		}
		removeFromIndex(file.id);
		db.delete(files).where(eq(files.id, file.id)).run();
	}

	// Update storage for each user
	for (const [userId, freed] of byUser) {
		const current = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, userId)).get();
		const newUsed = Math.max(0, (current?.used || 0) - freed);
		db.update(users).set({ storageUsed: newUsed }).where(eq(users.id, userId)).run();
	}

	return expired.length;
}

let task: cron.ScheduledTask | null = null;

export function startTrashCron(): void {
	// Daily at 2:00 AM
	task = cron.schedule('0 2 * * *', async () => {
		console.log('[trash] Purging expired items...');
		try {
			const count = await purgeExpiredTrash();
			console.log(`[trash] Purged ${count} expired items.`);
		} catch (e) {
			console.error('[trash] Purge failed:', e);
		}
	});

	console.log('[trash] Auto-purge cron started (daily 2:00 AM, 30-day retention)');
}

export function stopTrashCron(): void {
	task?.stop();
}
