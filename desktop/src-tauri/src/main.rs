#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Default, Serialize, Deserialize, Clone)]
struct SyncStatus {
    uploaded: u32,
    downloaded: u32,
    last_sync: Option<String>,
    running: bool,
    error: Option<String>,
}

struct AppState {
    status: Mutex<SyncStatus>,
}

#[derive(Serialize)]
struct ConnectionResult {
    ok: bool,
    error: Option<String>,
}

#[tauri::command]
fn test_connection(url: String, email: String, password: String) -> ConnectionResult {
    let client = match reqwest::blocking::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
    {
        Ok(c) => c,
        Err(e) => return ConnectionResult { ok: false, error: Some(format!("Client error: {e}")) },
    };

    let auth = format!("{email}:{password}");
    let encoded = base64_encode(&auth);

    match client
        .get(format!("{url}/dav/"))
        .header("Authorization", format!("Basic {encoded}"))
        .send()
    {
        Ok(resp) => {
            if resp.status().as_u16() == 401 {
                ConnectionResult { ok: false, error: Some("Invalid credentials".into()) }
            } else if resp.status().is_success() || resp.status().as_u16() == 207 {
                ConnectionResult { ok: true, error: None }
            } else {
                ConnectionResult {
                    ok: false,
                    error: Some(format!("Server returned {}", resp.status())),
                }
            }
        }
        Err(e) => ConnectionResult { ok: false, error: Some(format!("Connection failed: {e}")) },
    }
}

fn base64_encode(input: &str) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut result = String::new();
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let n = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[(n >> 18 & 63) as usize] as char);
        result.push(CHARS[(n >> 12 & 63) as usize] as char);
        if chunk.len() > 1 { result.push(CHARS[(n >> 6 & 63) as usize] as char); } else { result.push('='); }
        if chunk.len() > 2 { result.push(CHARS[(n & 63) as usize] as char); } else { result.push('='); }
    }
    result
}

#[tauri::command]
fn start_sync(state: tauri::State<AppState>, _url: String, _email: String, _password: String, _dir: String) -> String {
    let mut status = state.status.lock().unwrap();
    status.running = true;
    status.error = None;
    "Sync started".to_string()
}

#[tauri::command]
fn stop_sync(state: tauri::State<AppState>) -> String {
    let mut status = state.status.lock().unwrap();
    status.running = false;
    "Sync stopped".to_string()
}

#[tauri::command]
fn sync_status(state: tauri::State<AppState>) -> SyncStatus {
    state.status.lock().unwrap().clone()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .manage(AppState {
            status: Mutex::new(SyncStatus::default()),
        })
        .invoke_handler(tauri::generate_handler![
            test_connection,
            start_sync,
            stop_sync,
            sync_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
