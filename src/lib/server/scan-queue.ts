import { db } from './db';
import { files, users } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { scanFile, isScannerAvailable } from './antivirus';
import { createNotification } from './notifications';
import { join } from 'node:path';
import { rename, mkdir } from 'node:fs/promises';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || './data/uploads';
const QUARANTINE_DIR = process.env.QUARANTINE_DIR || './data/quarantine';
const MAX_CONCURRENT = 3;

let activeCount = 0;
const queue: Array<{ fileId: string; userId: string; fileName: string }> = [];
let processing = false;

export function queueFileScan(fileId: string, userId: string, fileName: string): void {
	// Don't queue if scanner is not available
	if (!isScannerAvailable()) {
		try {
			db.update(files).set({
				scanStatus: 'skipped',
				scanResult: JSON.stringify({ error: 'ClamAV not available', scannedAt: new Date().toISOString() })
			}).where(eq(files.id, fileId)).run();
		} catch {}
		return;
	}

	queue.push({ fileId, userId, fileName });
	processQueue();
}

async function processQueue(): Promise<void> {
	if (processing) return;
	processing = true;

	try {
		// Safety: if ClamAV went away, drain queue with 'skipped'
		if (!isScannerAvailable()) {
			let item;
			while ((item = queue.shift())) {
				try {
					db.update(files).set({ scanStatus: 'skipped' }).where(eq(files.id, item.fileId)).run();
				} catch {}
			}
			return;
		}

		while (queue.length > 0 && activeCount < MAX_CONCURRENT) {
			const item = queue.shift();
			if (!item) break;
			activeCount++;
			processScan(item).finally(() => {
				activeCount--;
				if (queue.length > 0 && isScannerAvailable()) {
					processQueue();
				}
			});
		}
	} finally {
		processing = false;
	}
}

async function processScan(item: { fileId: string; userId: string; fileName: string }): Promise<void> {
	const { fileId, userId, fileName } = item;

	try {
		const file = db.select().from(files).where(eq(files.id, fileId)).get();
		if (!file) return;

		// Skip encrypted files — server can't read them
		if (file.encrypted) {
			db.update(files).set({ scanStatus: 'skipped', scanResult: JSON.stringify({ reason: 'encrypted', scannedAt: new Date().toISOString() }) }).where(eq(files.id, fileId)).run();
			return;
		}

		const fullPath = join(UPLOAD_ROOT, userId, fileId, fileName);
		const result = await scanFile(fullPath);

		if (!result.scanned) {
			db.update(files).set({ scanStatus: 'skipped', scanResult: JSON.stringify({ error: result.error, scannedAt: new Date().toISOString() }) }).where(eq(files.id, fileId)).run();
			return;
		}

		if (result.isInfected) {
			console.warn(`[antivirus] INFECTED: ${fileName} — ${result.viruses.join(', ')}`);

			// Quarantine
			await mkdir(QUARANTINE_DIR, { recursive: true });
			try { await rename(fullPath, join(QUARANTINE_DIR, `${fileId}_${fileName}`)); } catch {}

			// Update DB + soft delete
			db.update(files).set({
				scanStatus: 'infected',
				scanResult: JSON.stringify({ viruses: result.viruses, scannedAt: new Date().toISOString(), scanTimeMs: result.scanTimeMs, quarantined: true }),
				deletedAt: new Date()
			}).where(eq(files.id, fileId)).run();

			// Free storage
			const user = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, userId)).get();
			if (user) {
				db.update(users).set({ storageUsed: Math.max(0, (user.used ?? 0) - file.size) }).where(eq(users.id, userId)).run();
			}

			// Notify
			try {
				createNotification({
					userId,
					type: 'system',
					title: 'Malware detected',
					body: `"${fileName}" was infected with ${result.viruses.join(', ')} and has been quarantined.`,
					icon: 'gpp_bad'
				});
			} catch {}
		} else {
			db.update(files).set({
				scanStatus: 'clean',
				scanResult: JSON.stringify({ scannedAt: new Date().toISOString(), scanTimeMs: result.scanTimeMs })
			}).where(eq(files.id, fileId)).run();
		}
	} catch (err: any) {
		console.error(`[antivirus] Error scanning ${fileName}:`, err.message);
		try {
			db.update(files).set({ scanStatus: 'skipped', scanResult: JSON.stringify({ error: err.message, scannedAt: new Date().toISOString() }) }).where(eq(files.id, fileId)).run();
		} catch {}
	}
}

export async function scanPendingFiles(): Promise<{ queued: number }> {
	// Immediately bail if ClamAV is not available — no log spam
	if (!isScannerAvailable()) {
		return { queued: 0 };
	}

	const pending = db.select({ id: files.id, userId: files.userId, name: files.name })
		.from(files)
		.where(and(eq(files.isFolder, false)))
		.all()
		.filter(f => {
			const row = db.select({ s: files.scanStatus }).from(files).where(eq(files.id, f.id)).get();
			return row?.s === 'pending';
		});

	for (const f of pending) {
		queueFileScan(f.id, f.userId, f.name);
	}

	if (pending.length > 0) {
		console.log(`[antivirus] Queued ${pending.length} pending files for scanning`);
	}
	return { queued: pending.length };
}

// Single delayed startup scan — gives ClamAV time to start
let startupScanDone = false;
setTimeout(async () => {
	if (startupScanDone) return;
	startupScanDone = true;

	if (isScannerAvailable()) {
		const result = await scanPendingFiles();
		if (result.queued > 0) {
			console.log(`[antivirus] Initial scan complete: ${result.queued} files queued`);
		}
	} else {
		console.log('[antivirus] Skipping initial scan — ClamAV not available');
	}
}, 60_000);
