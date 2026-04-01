#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod bandwidth;
mod cloud_provider;
mod commands;
mod context_menu;
mod db;
mod notifications;
mod sync_engine;
mod tray;
mod watcher;

use commands::AppState;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Listener, Manager};

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    // Handle CLI actions from context menu (--action share/browser/sync)
    let args: Vec<String> = std::env::args().collect();
    if context_menu::handle_cli_action(&args) {
        return;
    }

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

            // Shared state
            let api = api::LiteCloudApi::new();
            let paused = Arc::new(AtomicBool::new(false));
            let syncing = Arc::new(AtomicBool::new(false));

            app.manage(AppState {
                api: api.clone(),
                db: Mutex::new(sync_db),
                sync_folder: Mutex::new(String::new()),
                paused: paused.clone(),
                syncing: syncing.clone(),
            });

            // System tray
            tray::setup_tray(app.handle())?;

            // Register Explorer context menu
            if let Ok(exe) = std::env::current_exe() {
                if let Some(exe_str) = exe.to_str() {
                    context_menu::register(exe_str).ok();
                }
            }

            // Tray events
            let handle = app.handle().clone();
            app.listen("tray-sync-now", move |_| {
                handle.emit("trigger-sync", ()).ok();
            });

            let handle2 = app.handle().clone();
            let paused2 = paused.clone();
            app.listen("tray-toggle-pause", move |_| {
                let was = paused2.load(Ordering::Relaxed);
                paused2.store(!was, Ordering::Relaxed);
                handle2.emit("pause-changed", !was).ok();
                log::info!("[sync] Paused: {}", !was);
            });

            app.listen("tray-open-folder", {
                let handle = app.handle().clone();
                move |_| {
                    if let Some(state) = handle.try_state::<AppState>() {
                        if let Ok(folder) = state.sync_folder.lock() {
                            if !folder.is_empty() {
                                #[cfg(target_os = "windows")]
                                std::process::Command::new("explorer")
                                    .arg(folder.as_str())
                                    .spawn()
                                    .ok();
                            }
                        }
                    }
                }
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
