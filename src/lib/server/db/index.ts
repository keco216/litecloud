import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.DB_PATH || './data/litecloud.db';

mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };

migrate(db, { migrationsFolder: './drizzle' });

// Create FTS5 virtual table for full-text search (idempotent)
sqlite.exec(`
	CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
		file_id UNINDEXED,
		user_id UNINDEXED,
		name,
		extracted_text,
		tokenize='unicode61'
	);
`);

// Start backup cron jobs
import { startBackupCron } from '../backup';
startBackupCron();
