use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

pub fn notify_sync_complete(app: &AppHandle, uploaded: usize, downloaded: usize) {
    if uploaded == 0 && downloaded == 0 {
        return;
    }

    let body = match (uploaded, downloaded) {
        (u, 0) => format!("{} Datei(en) hochgeladen", u),
        (0, d) => format!("{} Datei(en) heruntergeladen", d),
        (u, d) => format!("{} hochgeladen, {} heruntergeladen", u, d),
    };

    app.notification()
        .builder()
        .title("LiteCloud — Sync abgeschlossen")
        .body(&body)
        .show()
        .ok();
}

pub fn notify_conflict(app: &AppHandle, file_name: &str) {
    app.notification()
        .builder()
        .title("LiteCloud — Sync-Konflikt")
        .body(&format!(
            "\"{}\" wurde auf beiden Seiten geändert.",
            file_name
        ))
        .show()
        .ok();
}

pub fn notify_error(app: &AppHandle, message: &str) {
    app.notification()
        .builder()
        .title("LiteCloud — Sync-Fehler")
        .body(message)
        .show()
        .ok();
}

pub fn notify_offline(app: &AppHandle) {
    app.notification()
        .builder()
        .title("LiteCloud — Offline")
        .body("Verbindung zum Server verloren. Sync wird fortgesetzt sobald die Verbindung wiederhergestellt ist.")
        .show()
        .ok();
}

pub fn notify_storage_warning(app: &AppHandle, used_pct: u8) {
    app.notification()
        .builder()
        .title("LiteCloud — Speicher wird knapp")
        .body(&format!("{}% deines Cloud-Speichers sind belegt.", used_pct))
        .show()
        .ok();
}
