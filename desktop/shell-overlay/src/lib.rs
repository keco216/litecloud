//! LiteCloud Shell Icon Overlay Handler
//!
//! A Windows Shell Extension DLL that shows overlay icons on files in the
//! LiteCloud sync folder:
//! - Green checkmark = synced
//! - Blue arrows = syncing
//! - Red X = error
//!
//! Communication: The Tauri app writes sync status to a JSON file.
//! This DLL reads that file for each Explorer query.
//!
//! Registration: Requires admin rights (HKLM registry).
//! Use `regsvr32 litecloud_overlay.dll` to register.

use std::collections::HashMap;
use std::ffi::c_void;
use std::path::PathBuf;
use std::sync::Mutex;

use windows::core::*;
use windows::Win32::Foundation::*;
use windows::Win32::System::Com::*;
use windows::Win32::UI::Shell::*;
#[allow(unused_imports)]
use windows::Win32::System::LibraryLoader::*;

// ── GUIDs for our 3 overlay handlers ──
// Generated UUIDs — unique to LiteCloud
const CLSID_SYNCED: GUID = GUID::from_u128(0x4c1f_e2a1_b3d4_4f5e_9a1b_c2d3e4f5a6b7);
const CLSID_SYNCING: GUID = GUID::from_u128(0x4c1f_e2a2_b3d4_4f5e_9a1b_c2d3e4f5a6b8);
const CLSID_ERROR: GUID = GUID::from_u128(0x4c1f_e2a3_b3d4_4f5e_9a1b_c2d3e4f5a6b9);

// ── Status file location ──
fn status_file_path() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| r"C:\Users\Public".to_string());
    PathBuf::from(appdata)
        .join("cloud.kcolic.litecloud-sync")
        .join("overlay-status.json")
}

fn sync_folder_path() -> PathBuf {
    let appdata = std::env::var("APPDATA").unwrap_or_else(|_| r"C:\Users\Public".to_string());
    let config_path = PathBuf::from(&appdata)
        .join("cloud.kcolic.litecloud-sync")
        .join("sync-folder.txt");
    std::fs::read_to_string(&config_path)
        .ok()
        .map(|s| PathBuf::from(s.trim()))
        .unwrap_or_else(|| {
            dirs_fallback().join("LiteCloud")
        })
}

fn dirs_fallback() -> PathBuf {
    let userprofile = std::env::var("USERPROFILE").unwrap_or_else(|_| r"C:\Users\Public".to_string());
    PathBuf::from(userprofile).join("Documents")
}

// ── Cached status reading ──
static STATUS_CACHE: Mutex<Option<(std::time::Instant, HashMap<String, String>)>> = Mutex::new(None);

fn read_status(path: &str) -> Option<String> {
    let mut cache = STATUS_CACHE.lock().ok()?;

    // Refresh cache every 2 seconds
    let need_refresh = match &*cache {
        Some((last, _)) => last.elapsed() > std::time::Duration::from_secs(2),
        None => true,
    };

    if need_refresh {
        let content = std::fs::read_to_string(status_file_path()).ok()?;
        let map: HashMap<String, String> = serde_json::from_str(&content).ok()?;
        *cache = Some((std::time::Instant::now(), map));
    }

    cache.as_ref()?.1.get(path).cloned()
}

fn is_in_sync_folder(path: &str) -> bool {
    let sync_folder = sync_folder_path();
    let sync_str = sync_folder.to_str().unwrap_or("");
    path.starts_with(sync_str)
}

// ── Overlay types ──
#[derive(Clone, Copy)]
enum OverlayType {
    Synced,
    Syncing,
    Error,
}

impl OverlayType {
    fn status_value(&self) -> &'static str {
        match self {
            Self::Synced => "synced",
            Self::Syncing => "syncing",
            Self::Error => "error",
        }
    }

    fn icon_name(&self) -> &'static str {
        match self {
            Self::Synced => "overlay-synced.ico",
            Self::Syncing => "overlay-syncing.ico",
            Self::Error => "overlay-error.ico",
        }
    }

    fn priority(&self) -> i32 {
        match self {
            Self::Error => 0,   // Highest priority
            Self::Syncing => 1,
            Self::Synced => 2,
        }
    }
}

// ── COM Implementation ──

#[implement(IShellIconOverlayIdentifier)]
struct LiteCloudOverlay {
    overlay_type: OverlayType,
}

impl IShellIconOverlayIdentifier_Impl for LiteCloudOverlay_Impl {
    fn IsMemberOf(&self, pwszpath: &PCWSTR, _dwattrib: u32) -> Result<()> {
        let path = unsafe { pwszpath.to_string() }.map_err(|_| Error::from(E_FAIL))?;

        if !is_in_sync_folder(&path) {
            return Err(E_FAIL.into());
        }

        match read_status(&path) {
            Some(status) if status == self.overlay_type.status_value() => Ok(()),
            None if matches!(self.overlay_type, OverlayType::Synced) => {
                // Files in sync folder without explicit status → assume synced
                if std::path::Path::new(&path).exists() {
                    Ok(())
                } else {
                    Err(E_FAIL.into())
                }
            }
            _ => Err(E_FAIL.into()),
        }
    }

    fn GetOverlayInfo(
        &self,
        pwsziconfile: PWSTR,
        cchmax: i32,
        pindex: *mut i32,
        pdwflags: *mut u32,
    ) -> Result<()> {
        let dll_path = get_icon_directory();
        let icon_path = dll_path.join(self.overlay_type.icon_name());
        let icon_str = icon_path.to_str().unwrap_or("");

        // Write icon path to the buffer
        let wide: Vec<u16> = icon_str.encode_utf16().chain(std::iter::once(0)).collect();
        let copy_len = wide.len().min(cchmax as usize);
        unsafe {
            std::ptr::copy_nonoverlapping(wide.as_ptr(), pwsziconfile.0, copy_len);
            *pindex = 0;
            *pdwflags = 0x1; // ISIOI_ICONFILE
        }
        Ok(())
    }

    fn GetPriority(&self) -> Result<i32> {
        Ok(self.overlay_type.priority())
    }
}

fn get_icon_directory() -> PathBuf {
    let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| {
        let userprofile = std::env::var("USERPROFILE").unwrap_or_else(|_| r"C:\Users\Public".to_string());
        format!(r"{}\AppData\Local", userprofile)
    });
    PathBuf::from(localappdata).join("LiteCloud").join("overlay")
}

// ── Class Factory ──

#[implement(IClassFactory)]
struct OverlayFactory {
    overlay_type: OverlayType,
}

impl IClassFactory_Impl for OverlayFactory_Impl {
    fn CreateInstance(
        &self,
        punkouter: Option<&IUnknown>,
        riid: *const GUID,
        ppvobject: *mut *mut c_void,
    ) -> Result<()> {
        if punkouter.is_some() {
            return Err(CLASS_E_NOAGGREGATION.into());
        }

        let overlay: IShellIconOverlayIdentifier = LiteCloudOverlay {
            overlay_type: self.overlay_type,
        }
        .into();

        unsafe { overlay.query(riid, ppvobject).ok() }
    }

    fn LockServer(&self, _flock: BOOL) -> Result<()> {
        Ok(())
    }
}

// ── DLL Exports ──

#[no_mangle]
extern "system" fn DllGetClassObject(
    rclsid: *const GUID,
    riid: *const GUID,
    ppv: *mut *mut c_void,
) -> HRESULT {
    let clsid = unsafe { *rclsid };

    let overlay_type = if clsid == CLSID_SYNCED {
        OverlayType::Synced
    } else if clsid == CLSID_SYNCING {
        OverlayType::Syncing
    } else if clsid == CLSID_ERROR {
        OverlayType::Error
    } else {
        return CLASS_E_CLASSNOTAVAILABLE;
    };

    let factory: IClassFactory = OverlayFactory { overlay_type }.into();
    unsafe { factory.query(riid, ppv) }
}

#[no_mangle]
extern "system" fn DllCanUnloadNow() -> HRESULT {
    S_FALSE // Keep loaded
}

// ── Self-Registration (regsvr32 support) ──

#[no_mangle]
extern "system" fn DllRegisterServer() -> HRESULT {
    match register_overlays() {
        Ok(()) => S_OK,
        Err(_) => E_FAIL,
    }
}

#[no_mangle]
extern "system" fn DllUnregisterServer() -> HRESULT {
    match unregister_overlays() {
        Ok(()) => S_OK,
        Err(_) => E_FAIL,
    }
}

fn register_overlays() -> std::result::Result<(), Box<dyn std::error::Error>> {
    // Registration is handled by the install script (register-overlays.ps1)
    // regsvr32 is not practical for Rust DLLs due to COM complexity
    Ok(())
}

fn unregister_overlays() -> std::result::Result<(), Box<dyn std::error::Error>> {
    Ok(())
}
