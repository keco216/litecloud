/// Writes overlay status to a JSON file that the Shell Extension DLL reads.
/// File location: %APPDATA%/cloud.kcolic.litecloud-sync/overlay-status.json
///
/// Format:
/// {
///   "C:\\Users\\Kevin\\Documents\\LiteCloud\\file.docx": "synced",
///   "C:\\Users\\Kevin\\Documents\\LiteCloud\\photo.jpg": "syncing"
/// }

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

fn status_dir() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(appdata).join("cloud.kcolic.litecloud-sync")
}

/// Write the sync folder path so the Shell Extension knows which folder to monitor.
pub fn write_sync_folder(sync_folder: &Path) {
    let dir = status_dir();
    fs::create_dir_all(&dir).ok();
    let path = dir.join("sync-folder.txt");
    fs::write(&path, sync_folder.to_str().unwrap_or("")).ok();
}

/// Mark all files in the sync folder as synced.
pub fn mark_all_synced(sync_folder: &Path) {
    let mut status: HashMap<String, String> = HashMap::new();
    walk_and_mark(sync_folder, &mut status);
    write_status(&status);
}

/// Mark specific files with a status.
pub fn mark_files(files: &[(PathBuf, &str)]) {
    // Read existing status
    let mut status = read_existing_status();
    for (path, s) in files {
        if let Some(p) = path.to_str() {
            status.insert(p.to_string(), s.to_string());
        }
    }
    write_status(&status);
}

/// Mark a single file as syncing (blue arrows).
pub fn mark_syncing(path: &Path) {
    let mut status = read_existing_status();
    if let Some(p) = path.to_str() {
        status.insert(p.to_string(), "syncing".to_string());
    }
    write_status(&status);
}

/// Mark a single file as synced (green checkmark).
pub fn mark_synced(path: &Path) {
    let mut status = read_existing_status();
    if let Some(p) = path.to_str() {
        status.insert(p.to_string(), "synced".to_string());
    }
    write_status(&status);
}

/// Mark a single file as error (red X).
pub fn mark_error(path: &Path) {
    let mut status = read_existing_status();
    if let Some(p) = path.to_str() {
        status.insert(p.to_string(), "error".to_string());
    }
    write_status(&status);
}

fn read_existing_status() -> HashMap<String, String> {
    let path = status_dir().join("overlay-status.json");
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_status(status: &HashMap<String, String>) {
    let dir = status_dir();
    fs::create_dir_all(&dir).ok();
    let path = dir.join("overlay-status.json");
    if let Ok(json) = serde_json::to_string(status) {
        fs::write(&path, json).ok();
    }
}

fn walk_and_mark(dir: &Path, status: &mut HashMap<String, String>) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = path.file_name().unwrap_or_default().to_str().unwrap_or("");
        if name.starts_with('.') || name == "Thumbs.db" || name == "desktop.ini" {
            continue;
        }
        if let Some(p) = path.to_str() {
            status.insert(p.to_string(), "synced".to_string());
        }
        if path.is_dir() {
            walk_and_mark(&path, status);
        }
    }
}
