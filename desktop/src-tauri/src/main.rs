#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod commands;
mod db;

use commands::AppState;
use std::sync::Mutex;
use tauri::Manager;

fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // Initialize sync database
            let app_data = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data).ok();
            let sync_db = db::SyncDb::open(&app_data).expect("Failed to open sync DB");

            // Manage shared state
            app.manage(AppState {
                api: api::LiteCloudApi::new(),
                db: Mutex::new(sync_db),
                sync_folder: Mutex::new(String::new()),
            });

            // Hide window on startup if --minimized flag
            if std::env::args().any(|a| a == "--minimized") {
                if let Some(window) = app.get_webview_window("main") {
                    window.hide().ok();
                }
            }

            log::info!("[app] LiteCloud Sync started");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::login,
            commands::select_sync_folder,
            commands::start_sync,
            commands::toggle_pause,
            commands::sync_now,
            commands::get_sync_status,
            commands::get_recent_activity,
            commands::resolve_conflict,
            commands::logout,
            commands::open_sync_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
