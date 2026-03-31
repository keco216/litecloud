import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync, unlinkSync, copyFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import cron from 'node-cron';

const DB_PATH = process.env.DB_PATH || './data/litecloud.db';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './data/uploads';
const BACKUP_DIR = process.env.BACKUP_DIR || './data/backups';
const EXTERNAL_BACKUP_DIR = process.env.EXTERNAL_BACKUP_DIR || '';
const DAILY_KEEP = 7;
const WEEKLY_KEEP = 4;

mkdirSync(BACKUP_DIR, { recursive: true });

export interface BackupInfo {
	name: string;
	size: number;
	date: string;
	type: 'daily' | 'weekly';
}

function timestamp(): string {
	return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export function createBackup(type: 'daily' | 'weekly' = 'daily'): BackupInfo {
	const ts = timestamp();
	const name = `litecloud-${type}-${ts}.tar.gz`;
	const outPath = join(BACKUP_DIR, name);

	// SQLite safe backup (uses .backup command)
	const dbDump = join(BACKUP_DIR, `_temp_db_${ts}.sqlite`);
	try {
		execSync(`sqlite3 "${DB_PATH}" ".backup '${dbDump}'"`, { stdio: 'pipe' });
	} catch {
		// Fallback: simple copy (safe with WAL mode checkpoint)
		execSync(`sqlite3 "${DB_PATH}" "PRAGMA wal_checkpoint(TRUNCATE);"`, { stdio: 'pipe' });
		copyFileSync(DB_PATH, dbDump);
	}

	// Create tar.gz with db dump + uploads
	const dbBasename = basename(dbDump);
	execSync(
		`tar -czf "${outPath}" -C "${BACKUP_DIR}" "${dbBasename}" -C "${join(process.cwd(), UPLOAD_DIR, '..')}" uploads`,
		{ stdio: 'pipe' }
	);

	// Remove temp db dump
	try { unlinkSync(dbDump); } catch {}

	const stat = statSync(outPath);

	// Copy to external if configured
	if (EXTERNAL_BACKUP_DIR) {
		try {
			mkdirSync(EXTERNAL_BACKUP_DIR, { recursive: true });
			copyFileSync(outPath, join(EXTERNAL_BACKUP_DIR, name));
		} catch (e) {
			console.error('[backup] Failed to copy to external:', e);
		}
	}

	return { name, size: stat.size, date: new Date().toISOString(), type };
}

export function rotateBackups(): void {
	const files = listBackups();
	const daily = files.filter((f) => f.type === 'daily').sort((a, b) => b.date.localeCompare(a.date));
	const weekly = files.filter((f) => f.type === 'weekly').sort((a, b) => b.date.localeCompare(a.date));

	// Remove excess daily backups
	for (const old of daily.slice(DAILY_KEEP)) {
		try { unlinkSync(join(BACKUP_DIR, old.name)); } catch {}
	}
	// Remove excess weekly backups
	for (const old of weekly.slice(WEEKLY_KEEP)) {
		try { unlinkSync(join(BACKUP_DIR, old.name)); } catch {}
	}
}

export function listBackups(): BackupInfo[] {
	try {
		return readdirSync(BACKUP_DIR)
			.filter((f) => f.startsWith('litecloud-') && f.endsWith('.tar.gz'))
			.map((name) => {
				const stat = statSync(join(BACKUP_DIR, name));
				const type = name.includes('-weekly-') ? 'weekly' : 'daily';
				return { name, size: stat.size, date: stat.mtime.toISOString(), type } as BackupInfo;
			})
			.sort((a, b) => b.date.localeCompare(a.date));
	} catch {
		return [];
	}
}

export function deleteBackup(name: string): boolean {
	const safeName = basename(name);
	if (!safeName.startsWith('litecloud-') || !safeName.endsWith('.tar.gz')) return false;
	try {
		unlinkSync(join(BACKUP_DIR, safeName));
		return true;
	} catch {
		return false;
	}
}

// ── Cron Jobs ──

let dailyTask: cron.ScheduledTask | null = null;
let weeklyTask: cron.ScheduledTask | null = null;

export function startBackupCron(): void {
	// Daily at 3:00 AM
	dailyTask = cron.schedule('0 3 * * *', () => {
		console.log('[backup] Running daily backup...');
		try {
			createBackup('daily');
			rotateBackups();
			console.log('[backup] Daily backup complete.');
		} catch (e) {
			console.error('[backup] Daily backup failed:', e);
		}
	});

	// Weekly on Sunday at 4:00 AM
	weeklyTask = cron.schedule('0 4 * * 0', () => {
		console.log('[backup] Running weekly backup...');
		try {
			createBackup('weekly');
			rotateBackups();
			console.log('[backup] Weekly backup complete.');
		} catch (e) {
			console.error('[backup] Weekly backup failed:', e);
		}
	});

	console.log('[backup] Cron jobs started (daily 3:00, weekly Sun 4:00)');
}

export function stopBackupCron(): void {
	dailyTask?.stop();
	weeklyTask?.stop();
}
