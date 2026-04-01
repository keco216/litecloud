use rusqlite::{params, Connection, Result};
use std::path::PathBuf;

pub struct SyncDb {
    conn: Connection,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SyncEntry {
    pub id: String,
    pub local_path: String,
    pub remote_path: String,
    pub local_hash: Option<String>,
    pub remote_modified: Option<i64>,
    pub local_modified: Option<i64>,
    pub size: i64,
    pub is_folder: bool,
    pub sync_status: String,
    pub last_synced: Option<i64>,
    pub error_message: Option<String>,
}

impl SyncDb {
    pub fn open(app_data_dir: &PathBuf) -> Result<Self> {
        std::fs::create_dir_all(app_data_dir).ok();
        let db_path = app_data_dir.join("sync-state.db");
        let conn = Connection::open(db_path)?;
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS sync_state (
                id TEXT PRIMARY KEY,
                local_path TEXT NOT NULL,
                remote_path TEXT NOT NULL,
                local_hash TEXT,
                remote_modified INTEGER,
                local_modified INTEGER,
                size INTEGER NOT NULL DEFAULT 0,
                is_folder INTEGER NOT NULL DEFAULT 0,
                sync_status TEXT NOT NULL DEFAULT 'synced',
                last_synced INTEGER,
                error_message TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_sync_local_path ON sync_state(local_path);
            CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_state(sync_status);

            CREATE TABLE IF NOT EXISTS sync_config (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                file_name TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );
            ",
        )?;
        Ok(Self { conn })
    }

    pub fn get_config(&self, key: &str) -> Option<String> {
        self.conn
            .query_row(
                "SELECT value FROM sync_config WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .ok()
    }

    pub fn set_config(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO sync_config (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn upsert(&self, entry: &SyncEntry) -> Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO sync_state (id, local_path, remote_path, local_hash, remote_modified, local_modified, size, is_folder, sync_status, last_synced, error_message)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                entry.id,
                entry.local_path,
                entry.remote_path,
                entry.local_hash,
                entry.remote_modified,
                entry.local_modified,
                entry.size,
                entry.is_folder,
                entry.sync_status,
                entry.last_synced,
                entry.error_message,
            ],
        )?;
        Ok(())
    }

    pub fn get_by_id(&self, id: &str) -> Option<SyncEntry> {
        self.conn
            .query_row(
                "SELECT id, local_path, remote_path, local_hash, remote_modified, local_modified, size, is_folder, sync_status, last_synced, error_message FROM sync_state WHERE id = ?1",
                params![id],
                |row| {
                    Ok(SyncEntry {
                        id: row.get(0)?,
                        local_path: row.get(1)?,
                        remote_path: row.get(2)?,
                        local_hash: row.get(3)?,
                        remote_modified: row.get(4)?,
                        local_modified: row.get(5)?,
                        size: row.get(6)?,
                        is_folder: row.get(7)?,
                        sync_status: row.get(8)?,
                        last_synced: row.get(9)?,
                        error_message: row.get(10)?,
                    })
                },
            )
            .ok()
    }

    pub fn get_all(&self) -> Result<Vec<SyncEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, local_path, remote_path, local_hash, remote_modified, local_modified, size, is_folder, sync_status, last_synced, error_message FROM sync_state"
        )?;
        let entries = stmt.query_map([], |row| {
            Ok(SyncEntry {
                id: row.get(0)?,
                local_path: row.get(1)?,
                remote_path: row.get(2)?,
                local_hash: row.get(3)?,
                remote_modified: row.get(4)?,
                local_modified: row.get(5)?,
                size: row.get(6)?,
                is_folder: row.get(7)?,
                sync_status: row.get(8)?,
                last_synced: row.get(9)?,
                error_message: row.get(10)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        Ok(entries)
    }

    pub fn delete_by_id(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM sync_state WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn log_activity(&self, action: &str, file_name: &str) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        self.conn.execute(
            "INSERT INTO activity_log (action, file_name, timestamp) VALUES (?1, ?2, ?3)",
            params![action, file_name, now],
        )?;
        // Keep only last 100 entries
        self.conn.execute(
            "DELETE FROM activity_log WHERE id NOT IN (SELECT id FROM activity_log ORDER BY timestamp DESC LIMIT 100)",
            [],
        )?;
        Ok(())
    }

    pub fn get_recent_activity(&self, limit: usize) -> Result<Vec<(String, String, i64)>> {
        let mut stmt = self.conn.prepare(
            "SELECT action, file_name, timestamp FROM activity_log ORDER BY timestamp DESC LIMIT ?1"
        )?;
        let entries = stmt.query_map(params![limit as i64], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, i64>(2)?))
        })?.collect::<Result<Vec<_>>>()?;
        Ok(entries)
    }
}
