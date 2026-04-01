/// Registry-based Windows Explorer context menu for LiteCloud files.
/// Adds "LiteCloud" submenu with: Share-Link, Open in Browser, Sync Now.
/// Uses HKCU (no admin rights needed).

#[cfg(target_os = "windows")]
pub fn register(exe_path: &str) -> Result<(), String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    // Register for files (*) and folders (Directory)
    for root in &[
        r"Software\Classes\*\shell\LiteCloud",
        r"Software\Classes\Directory\shell\LiteCloud",
    ] {
        let (key, _) = hkcu.create_subkey(root).map_err(|e| e.to_string())?;
        // IMPORTANT: Do NOT set (Default) — must remain unset for cascading menus.
        // Only MUIVerb is used for the display name.
        key.delete_value("").ok(); // Remove (Default) if it exists
        key.set_value("MUIVerb", &"LiteCloud").map_err(|e| e.to_string())?;
        key.set_value("Icon", &exe_path).map_err(|e| e.to_string())?;
        key.set_value("Position", &"Bottom").map_err(|e| e.to_string())?;
        key.set_value("SubCommands", &"").map_err(|e| e.to_string())?;

        // Sub: Share-Link erstellen
        {
            let sub = format!(r"{}\shell\01share", root);
            let (k, _) = hkcu.create_subkey(&sub).map_err(|e| e.to_string())?;
            k.set_value("", &"Share-Link erstellen").map_err(|e| e.to_string())?;
            k.set_value("MUIVerb", &"Share-Link erstellen").map_err(|e| e.to_string())?;
            let (cmd, _) = hkcu
                .create_subkey(&format!(r"{}\command", sub))
                .map_err(|e| e.to_string())?;
            cmd.set_value("", &format!(r#""{}" --action share --path "%1""#, exe_path))
                .map_err(|e| e.to_string())?;
        }

        // Sub: Im Browser öffnen
        {
            let sub = format!(r"{}\shell\02browser", root);
            let (k, _) = hkcu.create_subkey(&sub).map_err(|e| e.to_string())?;
            k.set_value("", &"Im Browser öffnen").map_err(|e| e.to_string())?;
            k.set_value("MUIVerb", &"Im Browser öffnen").map_err(|e| e.to_string())?;
            let (cmd, _) = hkcu
                .create_subkey(&format!(r"{}\command", sub))
                .map_err(|e| e.to_string())?;
            cmd.set_value("", &format!(r#""{}" --action browser --path "%1""#, exe_path))
                .map_err(|e| e.to_string())?;
        }

        // Sub: Jetzt synchronisieren
        {
            let sub = format!(r"{}\shell\03sync", root);
            let (k, _) = hkcu.create_subkey(&sub).map_err(|e| e.to_string())?;
            k.set_value("", &"Jetzt synchronisieren").map_err(|e| e.to_string())?;
            k.set_value("MUIVerb", &"Jetzt synchronisieren").map_err(|e| e.to_string())?;
            let (cmd, _) = hkcu
                .create_subkey(&format!(r"{}\command", sub))
                .map_err(|e| e.to_string())?;
            cmd.set_value("", &format!(r#""{}" --action sync"#, exe_path))
                .map_err(|e| e.to_string())?;
        }
    }

    log::info!("[context-menu] Registered Explorer context menu");
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn unregister() -> Result<(), String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    hkcu.delete_subkey_all(r"Software\Classes\*\shell\LiteCloud")
        .ok();
    hkcu.delete_subkey_all(r"Software\Classes\Directory\shell\LiteCloud")
        .ok();

    log::info!("[context-menu] Unregistered Explorer context menu");
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn register(_exe_path: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn unregister() -> Result<(), String> {
    Ok(())
}

/// Handle CLI actions from context menu (--action share/browser/sync --path "...")
pub fn handle_cli_action(args: &[String]) -> bool {
    let action_idx = match args.iter().position(|a| a == "--action") {
        Some(i) => i,
        None => return false,
    };

    let action = args.get(action_idx + 1).map(|s| s.as_str());
    let path_idx = args.iter().position(|a| a == "--path");
    let path = path_idx.and_then(|i| args.get(i + 1));

    match action {
        Some("share") => {
            if let Some(p) = path {
                log::info!("[cli] Share action for: {}", p);
                // TODO: Look up file ID from sync DB, create share via API
                // Copy link to clipboard, show notification
            }
            true
        }
        Some("browser") => {
            if let Some(p) = path {
                log::info!("[cli] Browser action for: {}", p);
                // TODO: Look up file ID, open browser to web app file view
            }
            true
        }
        Some("sync") => {
            log::info!("[cli] Sync action triggered");
            // TODO: Signal the running instance to sync now (named pipe/IPC)
            true
        }
        _ => false,
    }
}
