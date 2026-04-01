use crate::api::{LiteCloudApi, RemoteFile};
use crate::db::{SyncDb, SyncEntry};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

/// What the sync engine decides to do for each file.
#[derive(Debug)]
pub enum SyncAction {
    /// New or modified local file → upload to server
    Upload {
        local_path: PathBuf,
        remote_path: String,
        file_name: String,
    },
    /// New or modified remote file → download to local
    Download {
        file_id: String,
        local_path: PathBuf,
        file_name: String,
    },
    /// File deleted on server → delete locally
    DeleteLocal {
        local_path: PathBuf,
        file_name: String,
    },
    /// File deleted locally → delete on server (soft delete)
    DeleteRemote {
        file_id: String,
        file_name: String,
    },
    /// Both sides changed since last sync → conflict
    Conflict {
        file_id: String,
        local_path: PathBuf,
        file_name: String,
        reason: String,
    },
    /// Create a folder locally
    CreateLocalFolder {
        local_path: PathBuf,
    },
    /// Create a folder on server
    CreateRemoteFolder {
        remote_path: String,
        name: String,
    },
    /// Nothing to do
    Skip {
        file_name: String,
        reason: String,
    },
}

/// Summary of what happened during a sync cycle.
#[derive(Debug, Default, Clone, serde::Serialize)]
pub struct SyncReport {
    pub uploaded: usize,
    pub downloaded: usize,
    pub deleted_local: usize,
    pub deleted_remote: usize,
    pub conflicts: usize,
    pub skipped: usize,
    pub errors: Vec<String>,
    pub duration_ms: u64,
}

/// Represents a local file found by scanning the sync folder.
#[derive(Debug)]
struct LocalFile {
    /// Relative path from sync folder root (forward slashes, e.g. "docs/report.pdf")
    relative_path: String,
    /// File name only
    name: String,
    /// Parent folder path in LiteCloud format (e.g. "/docs")
    remote_parent: String,
    /// Full absolute path on disk
    absolute_path: PathBuf,
    /// File size in bytes
    size: i64,
    /// Last modified time as Unix timestamp
    modified: i64,
    /// Is a directory
    is_dir: bool,
}

pub struct SyncEngine {
    api: LiteCloudApi,
    sync_folder: PathBuf,
}

impl SyncEngine {
    pub fn new(api: LiteCloudApi, sync_folder: PathBuf) -> Self {
        Self { api, sync_folder }
    }

    // ── Full Sync ──────────────────────────────────────────────────────

    /// Runs a complete sync cycle:
    /// 1. Load remote file list
    /// 2. Scan local folder
    /// 3. Load known state from DB
    /// 4. Calculate actions (three-way merge)
    /// 5. Execute actions
    /// 6. Update sync state DB
    pub async fn full_sync(&self, db: &SyncDb) -> Result<SyncReport, String> {
        let start = Instant::now();
        let mut report = SyncReport::default();

        // 1. Get all remote files
        log::info!("[sync] Loading remote file list...");
        let remote_resp = self
            .api
            .get_full_file_list()
            .await
            .map_err(|e| format!("Failed to load remote files: {}", e))?;
        let server_time = remote_resp.server_time;

        // Build lookup: remote_path + "/" + name → RemoteFile
        let mut remote_map: HashMap<String, &RemoteFile> = HashMap::new();
        for f in &remote_resp.files {
            let key = make_remote_key(&f.path, &f.name);
            remote_map.insert(key, f);
        }

        // 2. Scan local folder
        log::info!("[sync] Scanning local folder...");
        let local_files = self.scan_local_folder()?;
        let mut local_map: HashMap<String, &LocalFile> = HashMap::new();
        for f in &local_files {
            local_map.insert(f.relative_path.clone(), f);
        }

        // 3. Load known sync state
        let known = db.get_all().map_err(|e| format!("DB error: {}", e))?;
        let mut known_map: HashMap<String, SyncEntry> = HashMap::new();
        for entry in known {
            let key = make_remote_key(&entry.remote_path, &entry.local_path.split('/').last().unwrap_or(""));
            known_map.insert(entry.id.clone(), entry);
        }
        // Also build by local_path for quick lookup
        let known_by_path: HashMap<String, &SyncEntry> = known_map
            .values()
            .map(|e| (e.local_path.clone(), e))
            .collect();

        // 4. Calculate actions
        log::info!("[sync] Calculating sync actions...");
        let actions = self.calculate_actions(
            &remote_resp.files,
            &local_files,
            &remote_map,
            &local_map,
            &known_map,
            &known_by_path,
        );

        // 5. Execute actions
        log::info!("[sync] Executing {} actions...", actions.len());
        for action in actions {
            match self.execute_action(&action, db, server_time).await {
                Ok(()) => match &action {
                    SyncAction::Upload { .. } => report.uploaded += 1,
                    SyncAction::Download { .. } => report.downloaded += 1,
                    SyncAction::DeleteLocal { .. } => report.deleted_local += 1,
                    SyncAction::DeleteRemote { .. } => report.deleted_remote += 1,
                    SyncAction::Conflict { .. } => report.conflicts += 1,
                    SyncAction::Skip { .. } => report.skipped += 1,
                    SyncAction::CreateLocalFolder { .. } | SyncAction::CreateRemoteFolder { .. } => {}
                },
                Err(e) => {
                    log::error!("[sync] Action failed: {}", e);
                    report.errors.push(e);
                }
            }
        }

        // Update last sync time
        db.set_config("last_sync", &server_time.to_string())
            .map_err(|e| format!("DB error: {}", e))?;

        report.duration_ms = start.elapsed().as_millis() as u64;
        log::info!(
            "[sync] Complete: {} up, {} down, {} del_local, {} del_remote, {} conflicts, {} errors in {}ms",
            report.uploaded, report.downloaded, report.deleted_local,
            report.deleted_remote, report.conflicts, report.errors.len(), report.duration_ms
        );

        Ok(report)
    }

    // ── Incremental Sync ───────────────────────────────────────────────

    /// Sync only changes since last sync (uses /api/sync?since=...)
    pub async fn incremental_sync(&self, db: &SyncDb) -> Result<SyncReport, String> {
        let start = Instant::now();
        let mut report = SyncReport::default();

        let last_sync = db
            .get_config("last_sync")
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);

        // Get remote changes since last sync
        let remote_resp = self
            .api
            .get_changes_since(last_sync)
            .await
            .map_err(|e| format!("Failed to get changes: {}", e))?;
        let server_time = remote_resp.server_time;

        for remote_file in &remote_resp.files {
            let rel_path = make_relative_path(&remote_file.path, &remote_file.name);
            let local_path = self.sync_folder.join(&rel_path);
            let known = db.get_by_id(&remote_file.id);

            // Skip encrypted files
            if remote_file.encrypted.unwrap_or(false) {
                continue;
            }

            if remote_file.deleted_at.is_some() {
                // Remote deleted → delete local if it exists
                if local_path.exists() {
                    match self
                        .execute_action(
                            &SyncAction::DeleteLocal {
                                local_path: local_path.clone(),
                                file_name: remote_file.name.clone(),
                            },
                            db,
                            server_time,
                        )
                        .await
                    {
                        Ok(()) => report.deleted_local += 1,
                        Err(e) => report.errors.push(e),
                    }
                }
                // Remove from sync state
                db.delete_by_id(&remote_file.id).ok();
            } else if remote_file.is_folder {
                // Ensure folder exists locally
                fs::create_dir_all(&local_path).ok();
            } else {
                // File created or modified on server
                let local_modified = get_mtime(&local_path);
                let needs_download = match &known {
                    Some(entry) => remote_file.updated_at > entry.remote_modified.unwrap_or(0),
                    None => true, // New file
                };

                if needs_download {
                    // Check for conflict: local also changed
                    if let Some(entry) = &known {
                        if let Some(lm) = local_modified {
                            if lm > entry.last_synced.unwrap_or(0) {
                                // Both changed → conflict
                                report.conflicts += 1;
                                let conflict_path = create_conflict_path(&local_path);
                                if local_path.exists() {
                                    fs::rename(&local_path, &conflict_path).ok();
                                }
                                db.log_activity("conflict", &remote_file.name).ok();
                            }
                        }
                    }

                    match self
                        .execute_action(
                            &SyncAction::Download {
                                file_id: remote_file.id.clone(),
                                local_path: local_path.clone(),
                                file_name: remote_file.name.clone(),
                            },
                            db,
                            server_time,
                        )
                        .await
                    {
                        Ok(()) => report.downloaded += 1,
                        Err(e) => report.errors.push(e),
                    }
                }
            }
        }

        // Also check for new/modified local files not yet synced
        let local_files = self.scan_local_folder()?;
        let known_all = db.get_all().map_err(|e| format!("DB error: {}", e))?;
        let known_paths: HashMap<String, &SyncEntry> = known_all
            .iter()
            .map(|e| (e.local_path.clone(), e))
            .collect();

        for local_file in &local_files {
            if local_file.is_dir {
                continue;
            }
            match known_paths.get(&local_file.relative_path) {
                None => {
                    // New local file → upload
                    match self
                        .execute_action(
                            &SyncAction::Upload {
                                local_path: local_file.absolute_path.clone(),
                                remote_path: local_file.remote_parent.clone(),
                                file_name: local_file.name.clone(),
                            },
                            db,
                            server_time,
                        )
                        .await
                    {
                        Ok(()) => report.uploaded += 1,
                        Err(e) => report.errors.push(e),
                    }
                }
                Some(entry) => {
                    // Known file — check if modified locally
                    if local_file.modified > entry.last_synced.unwrap_or(0) {
                        let current_hash = hash_file(&local_file.absolute_path).ok();
                        if current_hash.as_deref() != entry.local_hash.as_deref() {
                            match self
                                .execute_action(
                                    &SyncAction::Upload {
                                        local_path: local_file.absolute_path.clone(),
                                        remote_path: local_file.remote_parent.clone(),
                                        file_name: local_file.name.clone(),
                                    },
                                    db,
                                    server_time,
                                )
                                .await
                            {
                                Ok(()) => report.uploaded += 1,
                                Err(e) => report.errors.push(e),
                            }
                        }
                    }
                }
            }
        }

        // Check for locally deleted files (was in DB but no longer on disk)
        for entry in &known_all {
            let local_path = self.sync_folder.join(&entry.local_path);
            if !local_path.exists() && entry.sync_status == "synced" {
                match self
                    .execute_action(
                        &SyncAction::DeleteRemote {
                            file_id: entry.id.clone(),
                            file_name: entry.local_path.split('/').last().unwrap_or("").to_string(),
                        },
                        db,
                        server_time,
                    )
                    .await
                {
                    Ok(()) => report.deleted_remote += 1,
                    Err(e) => report.errors.push(e),
                }
            }
        }

        db.set_config("last_sync", &server_time.to_string()).ok();
        report.duration_ms = start.elapsed().as_millis() as u64;
        Ok(report)
    }

    // ── Calculate Actions (Three-Way Merge for full_sync) ──────────────

    fn calculate_actions<'a>(
        &self,
        remote_files: &'a [RemoteFile],
        local_files: &'a [LocalFile],
        _remote_map: &HashMap<String, &'a RemoteFile>,
        local_map: &HashMap<String, &'a LocalFile>,
        known_map: &HashMap<String, SyncEntry>,
        known_by_path: &HashMap<String, &SyncEntry>,
    ) -> Vec<SyncAction> {
        let mut actions = Vec::new();

        // Process remote files
        for rf in remote_files {
            // Skip encrypted files — desktop client can't read them
            if rf.encrypted.unwrap_or(false) {
                actions.push(SyncAction::Skip {
                    file_name: rf.name.clone(),
                    reason: "encrypted".to_string(),
                });
                continue;
            }

            let rel_path = make_relative_path(&rf.path, &rf.name);
            let local_path = self.sync_folder.join(&rel_path);

            if rf.is_folder {
                if !local_path.exists() {
                    actions.push(SyncAction::CreateLocalFolder { local_path });
                }
                continue;
            }

            let local = local_map.get(rel_path.as_str());
            let known = known_map.get(&rf.id);

            match (local, known) {
                // Remote exists, local exists, known in DB → check for changes
                (Some(lf), Some(entry)) => {
                    let remote_changed =
                        rf.updated_at > entry.remote_modified.unwrap_or(0);
                    let local_changed =
                        lf.modified > entry.last_synced.unwrap_or(0);

                    if remote_changed && local_changed {
                        // Both changed → conflict
                        actions.push(SyncAction::Conflict {
                            file_id: rf.id.clone(),
                            local_path: local_path,
                            file_name: rf.name.clone(),
                            reason: "Both local and remote modified".to_string(),
                        });
                    } else if remote_changed {
                        // Only remote changed → download
                        actions.push(SyncAction::Download {
                            file_id: rf.id.clone(),
                            local_path,
                            file_name: rf.name.clone(),
                        });
                    } else if local_changed {
                        // Only local changed → upload
                        actions.push(SyncAction::Upload {
                            local_path: lf.absolute_path.clone(),
                            remote_path: lf.remote_parent.clone(),
                            file_name: rf.name.clone(),
                        });
                    }
                    // else: neither changed → skip
                }
                // Remote exists, local exists, NOT in DB → first sync of existing file
                (Some(_lf), None) => {
                    // File exists on both sides but we have no prior state.
                    // Assume server is authoritative for first sync.
                    actions.push(SyncAction::Download {
                        file_id: rf.id.clone(),
                        local_path,
                        file_name: rf.name.clone(),
                    });
                }
                // Remote exists, local MISSING, known in DB → locally deleted
                (None, Some(_entry)) => {
                    actions.push(SyncAction::DeleteRemote {
                        file_id: rf.id.clone(),
                        file_name: rf.name.clone(),
                    });
                }
                // Remote exists, local MISSING, NOT in DB → new remote file
                (None, None) => {
                    actions.push(SyncAction::Download {
                        file_id: rf.id.clone(),
                        local_path,
                        file_name: rf.name.clone(),
                    });
                }
            }
        }

        // Find local files NOT on server (new local files to upload)
        let remote_rel_paths: std::collections::HashSet<String> = remote_files
            .iter()
            .map(|rf| make_relative_path(&rf.path, &rf.name))
            .collect();

        for lf in local_files {
            if lf.is_dir {
                // Check if folder exists on server
                if !remote_rel_paths.contains(&lf.relative_path) {
                    actions.push(SyncAction::CreateRemoteFolder {
                        remote_path: lf.remote_parent.clone(),
                        name: lf.name.clone(),
                    });
                }
                continue;
            }

            if !remote_rel_paths.contains(&lf.relative_path) {
                match known_by_path.get(lf.relative_path.as_str()) {
                    Some(_entry) => {
                        // Was in DB but not on server → remote deleted, skip
                        // (Don't re-upload a file the server deleted)
                    }
                    None => {
                        // Brand new local file → upload
                        actions.push(SyncAction::Upload {
                            local_path: lf.absolute_path.clone(),
                            remote_path: lf.remote_parent.clone(),
                            file_name: lf.name.clone(),
                        });
                    }
                }
            }
        }

        actions
    }

    // ── Execute a single action ────────────────────────────────────────

    async fn execute_action(
        &self,
        action: &SyncAction,
        db: &SyncDb,
        server_time: i64,
    ) -> Result<(), String> {
        match action {
            SyncAction::Download {
                file_id,
                local_path,
                file_name,
            } => {
                log::info!("[sync] ↓ Downloading: {}", file_name);
                self.api.download_file(file_id, local_path).await?;
                let hash = hash_file(local_path).unwrap_or_default();
                let size = fs::metadata(local_path).map(|m| m.len() as i64).unwrap_or(0);
                let mtime = get_mtime(local_path).unwrap_or(server_time);

                db.upsert(&SyncEntry {
                    id: file_id.clone(),
                    local_path: make_relative_from_abs(&self.sync_folder, local_path),
                    remote_path: local_path
                        .parent()
                        .and_then(|p| p.strip_prefix(&self.sync_folder).ok())
                        .map(|p| format!("/{}", p.to_str().unwrap_or("").replace('\\', "/")))
                        .unwrap_or_else(|| "/".to_string()),
                    local_hash: Some(hash),
                    remote_modified: Some(server_time),
                    local_modified: Some(mtime),
                    size,
                    is_folder: false,
                    sync_status: "synced".to_string(),
                    last_synced: Some(server_time),
                    error_message: None,
                })
                .map_err(|e| format!("DB error: {}", e))?;
                db.log_activity("downloaded", file_name).ok();
                Ok(())
            }

            SyncAction::Upload {
                local_path,
                remote_path,
                file_name,
            } => {
                log::info!("[sync] ↑ Uploading: {}", file_name);
                let result = self.api.upload_file(local_path, remote_path).await?;

                // Extract file ID from server response
                let file_id = result
                    .get("files")
                    .and_then(|f| f.as_array())
                    .and_then(|a| a.first())
                    .and_then(|f| f.get("id"))
                    .and_then(|id| id.as_str())
                    .unwrap_or("")
                    .to_string();

                if !file_id.is_empty() {
                    let hash = hash_file(local_path).unwrap_or_default();
                    let size = fs::metadata(local_path).map(|m| m.len() as i64).unwrap_or(0);
                    let mtime = get_mtime(local_path).unwrap_or(server_time);

                    db.upsert(&SyncEntry {
                        id: file_id,
                        local_path: make_relative_from_abs(&self.sync_folder, local_path),
                        remote_path: remote_path.clone(),
                        local_hash: Some(hash),
                        remote_modified: Some(server_time),
                        local_modified: Some(mtime),
                        size,
                        is_folder: false,
                        sync_status: "synced".to_string(),
                        last_synced: Some(server_time),
                        error_message: None,
                    })
                    .map_err(|e| format!("DB error: {}", e))?;
                }
                db.log_activity("uploaded", file_name).ok();
                Ok(())
            }

            SyncAction::DeleteLocal {
                local_path,
                file_name,
            } => {
                log::info!("[sync] ✕ Deleting local: {}", file_name);
                if local_path.is_dir() {
                    fs::remove_dir_all(local_path).ok();
                } else {
                    fs::remove_file(local_path).ok();
                }
                db.log_activity("deleted", file_name).ok();
                Ok(())
            }

            SyncAction::DeleteRemote {
                file_id,
                file_name,
            } => {
                log::info!("[sync] ✕ Deleting remote: {}", file_name);
                self.api.delete_file(file_id).await?;
                db.delete_by_id(file_id).ok();
                db.log_activity("deleted", file_name).ok();
                Ok(())
            }

            SyncAction::Conflict {
                file_id,
                local_path,
                file_name,
                reason,
            } => {
                log::warn!("[sync] ⚠ Conflict: {} — {}", file_name, reason);
                // Default resolution: keep both — rename local copy
                let conflict_path = create_conflict_path(local_path);
                if local_path.exists() {
                    fs::copy(local_path, &conflict_path)
                        .map_err(|e| format!("Conflict copy failed: {}", e))?;
                }
                // Download server version as the main file
                self.api.download_file(file_id, local_path).await?;
                db.log_activity("conflict", file_name).ok();
                Ok(())
            }

            SyncAction::CreateLocalFolder { local_path } => {
                fs::create_dir_all(local_path)
                    .map_err(|e| format!("Failed to create folder: {}", e))?;
                Ok(())
            }

            SyncAction::CreateRemoteFolder {
                remote_path,
                name,
            } => {
                log::info!("[sync] 📁 Creating remote folder: {}/{}", remote_path, name);
                self.api.create_folder(remote_path, name).await?;
                Ok(())
            }

            SyncAction::Skip { file_name, reason } => {
                log::debug!("[sync] ⏭ Skip: {} ({})", file_name, reason);
                Ok(())
            }
        }
    }

    // ── Local Folder Scanner ───────────────────────────────────────────

    fn scan_local_folder(&self) -> Result<Vec<LocalFile>, String> {
        let mut files = Vec::new();

        if !self.sync_folder.exists() {
            fs::create_dir_all(&self.sync_folder)
                .map_err(|e| format!("Failed to create sync folder: {}", e))?;
            return Ok(files);
        }

        self.scan_recursive(&self.sync_folder, &mut files)?;
        Ok(files)
    }

    fn scan_recursive(&self, dir: &Path, files: &mut Vec<LocalFile>) -> Result<(), String> {
        let entries = fs::read_dir(dir).map_err(|e| format!("Read dir error: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Entry error: {}", e))?;
            let path = entry.path();

            // Skip ignored files/folders
            if should_ignore(&path) {
                continue;
            }

            let metadata = entry
                .metadata()
                .map_err(|e| format!("Metadata error: {}", e))?;

            let relative = path
                .strip_prefix(&self.sync_folder)
                .unwrap_or(&path)
                .to_str()
                .unwrap_or("")
                .replace('\\', "/");

            let name = path
                .file_name()
                .unwrap_or_default()
                .to_str()
                .unwrap_or("")
                .to_string();

            let remote_parent = {
                let parent_rel = Path::new(&relative)
                    .parent()
                    .and_then(|p| p.to_str())
                    .unwrap_or("");
                if parent_rel.is_empty() {
                    "/".to_string()
                } else {
                    format!("/{}", parent_rel)
                }
            };

            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);

            let local_file = LocalFile {
                relative_path: relative,
                name,
                remote_parent,
                absolute_path: path.clone(),
                size: metadata.len() as i64,
                modified,
                is_dir: metadata.is_dir(),
            };

            files.push(local_file);

            if metadata.is_dir() {
                self.scan_recursive(&path, files)?;
            }
        }

        Ok(())
    }
}

// ── Helper Functions ───────────────────────────────────────────────────

/// Compute SHA-256 hash of a file
pub fn hash_file(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("Read error: {}", e))?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

/// Build a unique key for remote file lookup: "path/name"
fn make_remote_key(path: &str, name: &str) -> String {
    let p = path.trim_matches('/');
    if p.is_empty() {
        name.to_string()
    } else {
        format!("{}/{}", p, name)
    }
}

/// Convert remote path + name to relative local path
fn make_relative_path(remote_path: &str, name: &str) -> String {
    let p = remote_path.trim_matches('/');
    if p.is_empty() {
        name.to_string()
    } else {
        format!("{}/{}", p, name)
    }
}

/// Convert absolute local path to relative path from sync folder
fn make_relative_from_abs(sync_folder: &Path, absolute: &Path) -> String {
    absolute
        .strip_prefix(sync_folder)
        .unwrap_or(absolute)
        .to_str()
        .unwrap_or("")
        .replace('\\', "/")
}

/// Get file modification time as Unix timestamp
fn get_mtime(path: &Path) -> Option<i64> {
    fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(std::time::UNIX_EPOCH)
        .ok()
        .map(|d| d.as_secs() as i64)
}

/// Create a conflict copy path: "file.txt" → "file (Conflict 2026-04-01).txt"
fn create_conflict_path(path: &Path) -> PathBuf {
    let stem = path
        .file_stem()
        .unwrap_or_default()
        .to_str()
        .unwrap_or("file");
    let ext = path
        .extension()
        .map(|e| format!(".{}", e.to_str().unwrap_or("")))
        .unwrap_or_default();
    let date = chrono::Local::now().format("%Y-%m-%d");
    let conflict_name = format!("{} (Conflict {}){}", stem, date, ext);
    path.with_file_name(conflict_name)
}

/// Check if a path should be ignored during scanning
fn should_ignore(path: &Path) -> bool {
    let name = path
        .file_name()
        .unwrap_or_default()
        .to_str()
        .unwrap_or("");

    name.starts_with("~$")
        || name.starts_with('.')
        || name.ends_with(".tmp")
        || name.ends_with(".partial")
        || name.ends_with(".crdownload")
        || name == "Thumbs.db"
        || name == "desktop.ini"
        || name == ".DS_Store"
        || name == ".litecloud"
        || path
            .to_str()
            .unwrap_or("")
            .contains(std::path::MAIN_SEPARATOR_STR)
            && path.to_str().unwrap_or("").contains(".litecloud")
}
