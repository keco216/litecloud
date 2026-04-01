use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

/// Current sync status — drives tray icon and tooltip.
#[derive(Debug, Clone)]
pub enum SyncStatus {
    Idle,
    Syncing { progress: f32 },
    Error { message: String },
    Offline,
    Paused,
}

impl SyncStatus {
    pub fn tooltip(&self) -> String {
        match self {
            Self::Idle => "LiteCloud — Alles synchronisiert".to_string(),
            Self::Syncing { progress } => {
                format!("LiteCloud — Synchronisiere... ({:.0}%)", progress * 100.0)
            }
            Self::Error { message } => format!("LiteCloud — Fehler: {}", message),
            Self::Offline => "LiteCloud — Offline".to_string(),
            Self::Paused => "LiteCloud — Pausiert".to_string(),
        }
    }

    pub fn menu_label(&self) -> String {
        match self {
            Self::Idle => "✓ Alles synchronisiert".to_string(),
            Self::Syncing { progress } => {
                format!("↻ Synchronisiere... ({:.0}%)", progress * 100.0)
            }
            Self::Error { message } => format!("✗ {}", message),
            Self::Offline => "○ Offline".to_string(),
            Self::Paused => "⏸ Pausiert".to_string(),
        }
    }
}

/// Set up the system tray icon with context menu.
pub fn setup_tray<R: Runtime>(app: &AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "status", "✓ Alles synchronisiert", false, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "open_folder", "Sync-Ordner öffnen", true, None::<&str>)?,
            &MenuItem::with_id(
                app,
                "open_web",
                "LiteCloud im Browser öffnen",
                true,
                None::<&str>,
            )?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "sync_now", "Jetzt synchronisieren", true, None::<&str>)?,
            &MenuItem::with_id(app, "pause", "Sync pausieren", true, None::<&str>)?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(app, "settings", "Einstellungen...", true, None::<&str>)?,
            &MenuItem::with_id(app, "quit", "Beenden", true, None::<&str>)?,
        ],
    )?;

    let _tray = TrayIconBuilder::new()
        .tooltip("LiteCloud — Alles synchronisiert")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open_folder" => {
                app.emit("tray-open-folder", ()).ok();
            }
            "open_web" => {
                app.emit("tray-open-web", ()).ok();
            }
            "sync_now" => {
                app.emit("tray-sync-now", ()).ok();
            }
            "pause" => {
                app.emit("tray-toggle-pause", ()).ok();
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    window.show().ok();
                    window.set_focus().ok();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
