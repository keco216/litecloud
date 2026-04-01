use crate::api::LiteCloudApi;
use crate::db::SyncDb;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub api: LiteCloudApi,
    pub db: Mutex<SyncDb>,
    pub sync_folder: Mutex<String>,
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
    totp_code: Option<String>,
) -> Result<serde_json::Value, String> {
    state.api.set_base_url(&server_url).await;

    let result = state.api.login(&email, &password).await?;

    // Save config
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_config("server_url", &server_url).map_err(|e| e.to_string())?;
    db.set_config("email", &email).map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
pub async fn select_sync_folder() -> Result<String, String> {
    let default_path = dirs::document_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
        .join("LiteCloud");

    // For now return the default path — the frontend dialog plugin will handle the actual selection
    Ok(default_path.to_str().unwrap_or("").to_string())
}

#[tauri::command]
pub async fn start_sync(state: State<'_, AppState>) -> Result<(), String> {
    // TODO Phase 2: Start file watcher + initial sync
    log::info!("[sync] Sync started");
    Ok(())
}

#[tauri::command]
pub async fn toggle_pause() -> Result<bool, String> {
    // TODO Phase 2: Toggle sync pause state
    Ok(false)
}

#[tauri::command]
pub async fn sync_now(state: State<'_, AppState>) -> Result<(), String> {
    // TODO Phase 2: Trigger immediate sync
    log::info!("[sync] Manual sync triggered");
    Ok(())
}

#[tauri::command]
pub async fn get_sync_status(state: State<'_, AppState>) -> Result<SyncStatusResponse, String> {
    Ok(SyncStatusResponse {
        status: "idle".to_string(),
        progress: 0.0,
        last_sync: None,
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
    let entries = db.get_recent_activity(limit).map_err(|e| e.to_string())?;
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
pub async fn resolve_conflict(
    file_id: String,
    resolution: String,
) -> Result<(), String> {
    // TODO Phase 2: Implement conflict resolution
    log::info!("[sync] Resolving conflict for {} with {}", file_id, resolution);
    Ok(())
}

#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.set_config("server_url", "").map_err(|e| e.to_string())?;
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
            std::process::Command::new("explorer").arg(folder.as_str()).spawn().ok();
        }
    }
    Ok(())
}
