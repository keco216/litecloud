import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '$lib/server/db/schema';
import { mkdirSync, rmSync } from 'node:fs';

const TEST_DB = './data/test-litecloud.db';
const TEST_UPLOADS = './data/test-uploads';

export function createTestDb() {
	cleanupTestDb();
	mkdirSync('./data', { recursive: true });
	const sqlite = new Database(TEST_DB);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './drizzle' });
	sqlite.exec(`
		CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
			file_id UNINDEXED, user_id UNINDEXED, name, extracted_text, tokenize='unicode61'
		);
	`);
	return { db, sqlite };
}

export function cleanupTestDb() {
	for (const f of [TEST_DB, TEST_DB + '-wal', TEST_DB + '-shm']) {
		try { rmSync(f, { force: true }); } catch {}
	}
	try { rmSync(TEST_UPLOADS, { recursive: true, force: true }); } catch {}
}

export function getTestUploadsDir() {
	mkdirSync(TEST_UPLOADS, { recursive: true });
	return TEST_UPLOADS;
}
