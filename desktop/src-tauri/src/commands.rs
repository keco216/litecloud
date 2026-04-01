use crate::api::LiteCloudApi;
use crate::db::SyncDb;
use crate::sync_engine::SyncEngine;
use crate::watcher::{FileChangeEvent, FileWatcher};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use tauri::{AppHandle, Manager, State};

pub struct AppState {
    pub api: LiteCloudApi,
    pub db: Mutex<SyncDb>,
    pub sync_folder: Mutex<String>,
    pub paused: Arc<AtomicBool>,
    pub syncing: Arc<AtomicBool>,
}

#[derive(serde::Serialize)]
pub struct SyncStatusResponse {
    pub status: String,
    pub progress: f32,
    pub last_sync: Option<i64>,
    pub files_synced: usize,
    pub pending_changes: usize,
    pub conflicts: usize,
    pub error: Option<String>,
    pub storage_used: i64,
    pub storage_quota: i64,
}

#[derive(serde::Serialize)]
pub struct RecentActivity {
    pub action: String,
    pub file_name: String,
    pub timestamp: i64,
}

#[tauri::command]
pub async fn login(
    state: State<'_, AppState>,
    server_url: String,
    email: String,
    password: String,
    _totp_code: Option<String>,
) -> Result<serde_json::Value, String> {
    state.api.set_base_url(&server_url).await;
    let result = state.api.login(&email, &password).await?;

    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_config("server_url", &server_url)
        .map_err(|e| e.to_string())?;
    db.set_config("email", &email)
        .map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub async fn select_sync_folder(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let default_path = dirs::document_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
        .join("LiteCloud");

    let path_str = default_path.to_str().unwrap_or("").to_string();

    // Store the selected folder
    let mut folder = state.sync_folder.lock().map_err(|e| e.to_string())?;
    *folder = path_str.clone();

    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_config("sync_folder", &path_str)
        .map_err(|e| e.to_string())?;

    // Create the folder if it doesn't exist
    std::fs::create_dir_all(&default_path).ok();

    Ok(path_str)
}

#[tauri::command]
pub async fn start_sync(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let folder = state
        .sync_folder
        .lock()
        .map_err(|e| e.to_string())?
        .clone();

    if folder.is_empty() {
        return Err("No sync folder configured".to_string());
    }

    let sync_folder = std::path::PathBuf::from(&folder);
    let api = state.api.clone();
    let paused = state.paused.clone();
    let syncing = state.syncing.clone();

    // Get DB path from app state to open a new connection in the sync thread
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    // Spawn the sync loop in a background thread
    std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let engine = SyncEngine::new(api, sync_folder.clone());

        // Open a separate DB connection for the sync thread
        let db = match crate::db::SyncDb::open(&app_data) {
            Ok(db) => db,
            Err(e) => {
                log::error!("[sync] Failed to open DB: {}", e);
                return;
            }
        };

        // Start file watcher
        let (watcher_tx, watcher_rx) = mpsc::channel::<FileChangeEvent>();
        let _watcher = match FileWatcher::start(sync_folder.clone(), watcher_tx) {
            Ok(w) => {
                log::info!("[sync] File watcher started");
                Some(w)
            }
            Err(e) => {
                log::error!("[sync] File watcher failed: {}", e);
                None
            }
        };

        // Initial full sync
        log::info!("[sync] Running initial full sync...");
        syncing.store(true, Ordering::Relaxed);
        match rt.block_on(engine.full_sync(&db)) {
            Ok(report) => {
                log::info!(
                    "[sync] Initial sync done: {} up, {} down, {} errors",
                    report.uploaded,
                    report.downloaded,
                    report.errors.len()
                );
            }
            Err(e) => {
                log::error!("[sync] Initial sync failed: {}", e);
            }
        }
        syncing.store(false, Ordering::Relaxed);

        // Sync loop: check every 30s or when watcher triggers
        loop {
            // Wait for watcher event or 30s timeout
            match watcher_rx.recv_timeout(std::time::Duration::from_secs(30)) {
                Ok(FileChangeEvent::Changed(paths)) => {
                    log::debug!(
                        "[sync] File change detected: {} paths",
                        paths.len()
                    );
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    // Periodic sync
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    log::info!("[sync] Watcher disconnected, stopping sync loop");
                    break;
                }
            }

            // Skip if paused
            if paused.load(Ordering::Relaxed) {
                continue;
            }

            // Skip if already syncing
            if syncing.load(Ordering::Relaxed) {
                continue;
            }

            // Run incremental sync
            syncing.store(true, Ordering::Relaxed);
            match rt.block_on(engine.incremental_sync(&db)) {
                Ok(report) => {
                    if report.uploaded > 0
                        || report.downloaded > 0
                        || report.deleted_local > 0
                        || report.deleted_remote > 0
                    {
                        log::info!(
                            "[sync] Incremental sync: {} up, {} down, {} del_l, {} del_r",
                            report.uploaded,
                            report.downloaded,
                            report.deleted_local,
                            report.deleted_remote
                        );
                    }
                }
                Err(e) => {
                    log::error!("[sync] Incremental sync failed: {}", e);
                }
            }
            syncing.store(false, Ordering::Relaxed);
        }
    });

    log::info!("[sync] Sync loop started");
    Ok(())
}

#[tauri::command]
pub async fn toggle_pause(state: State<'_, AppState>) -> Result<bool, String> {
    let was = state.paused.load(Ordering::Relaxed);
    state.paused.store(!was, Ordering::Relaxed);
    Ok(!was)
}

#[tauri::command]
pub async fn sync_now(state: State<'_, AppState>) -> Result<(), String> {
    // The sync loop will pick up changes on next iteration
    // For immediate sync, we'd need to signal the loop — for now, just log
    log::info!("[sync] Manual sync requested");
    Ok(())
}

#[tauri::command]
pub async fn get_sync_status(state: State<'_, AppState>) -> Result<SyncStatusResponse, String> {
    let is_syncing = state.syncing.load(Ordering::Relaxed);
    let is_paused = state.paused.load(Ordering::Relaxed);

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let last_sync = db
        .get_config("last_sync")
        .and_then(|s| s.parse::<i64>().ok());

    let status = if is_paused {
        "paused"
    } else if is_syncing {
        "syncing"
    } else if last_sync.is_some() {
        "idle"
    } else {
        "offline"
    };

    Ok(SyncStatusResponse {
        status: status.to_string(),
        progress: if is_syncing { 0.5 } else { 0.0 },
        last_sync,
        files_synced: 0,
        pending_changes: 0,
        conflicts: 0,
        error: None,
        storage_used: 0,
        storage_quota: 0,
    })
}

#[tauri::command]
pub async fn get_recent_activity(
    state: State<'_, AppState>,
    limit: usize,
) -> Result<Vec<RecentActivity>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let entries = db
        .get_recent_activity(limit)
        .map_err(|e| e.to_string())?;
    Ok(entries
        .into_iter()
        .map(|(action, file_name, timestamp)| RecentActivity {
            action,
            file_name,
            timestamp,
        })
        .collect())
}

#[tauri::command]
pub async fn resolve_conflict(file_id: String, resolution: String) -> Result<(), String> {
    log::info!(
        "[sync] Resolving conflict for {} with {}",
        file_id,
        resolution
    );
    Ok(())
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_config("server_url", "")
        .map_err(|e| e.to_string())?;
    db.set_config("email", "").map_err(|e| e.to_string())?;
    log::info!("[sync] Logged out");
    Ok(())
}

#[tauri::command]
pub async fn open_sync_folder(state: State<'_, AppState>) -> Result<(), String> {
    let folder = state.sync_folder.lock().map_err(|e| e.to_string())?;
    if !folder.is_empty() {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("explorer")
                .arg(folder.as_str())
                .spawn()
                .ok();
        }
    }
    Ok(())
}
