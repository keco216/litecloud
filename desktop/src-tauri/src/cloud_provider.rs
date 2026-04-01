/// Windows Cloud Files API integration via the `cloud-filter` crate.
///
/// Provides:
/// - Sync root registration (LiteCloud appears in Explorer sidebar)
/// - Overlay icons on files (green checkmark = synced, blue arrows = syncing)
///
/// Requires Windows 10 1709+ and NTFS.

#[cfg(target_os = "windows")]
mod inner {
    use cloud_filter::{
        error::{CResult, CloudErrorKind},
        filter::{info, ticket, Request, SyncFilter},
        placeholder::{ConvertOptions, Placeholder},
        root::{HydrationType, PopulationType, SecurityId, Session, SyncRootIdBuilder, SyncRootInfo},
    };
    use std::fs;
    use std::path::{Path, PathBuf};

    const PROVIDER_NAME: &str = "LiteCloud";
    const DISPLAY_NAME: &str = "LiteCloud";
    const VERSION: &str = "1.0.0";
    const ICON_RESOURCE: &str = "%SystemRoot%\\system32\\shell32.dll,14";

    pub struct CloudProvider {
        sync_folder: PathBuf,
        _connection: Option<Box<dyn std::any::Any>>,
    }

    impl CloudProvider {
        pub fn new(sync_folder: PathBuf) -> Self {
            Self {
                sync_folder,
                _connection: None,
            }
        }

        /// Register the sync folder as a Windows Cloud Provider.
        pub fn register(&self) -> Result<(), String> {
            let sync_root_id = SyncRootIdBuilder::new(PROVIDER_NAME)
                .user_security_id(
                    SecurityId::current_user().map_err(|e| format!("SID error: {:?}", e))?,
                )
                .build();

            if sync_root_id.is_registered().unwrap_or(false) {
                log::info!("[cloud] Sync root already registered");
                return Ok(());
            }

            fs::create_dir_all(&self.sync_folder).ok();

            let info = SyncRootInfo::default()
                .with_display_name(DISPLAY_NAME)
                .with_icon(ICON_RESOURCE)
                .with_version(VERSION)
                .with_hydration_type(HydrationType::Full)
                .with_population_type(PopulationType::Full)
                .with_path(&self.sync_folder)
                .map_err(|e| format!("Path error: {:?}", e))?;

            sync_root_id
                .register(info)
                .map_err(|e| format!("Register error: {:?}", e))?;

            log::info!(
                "[cloud] Sync root registered: {}",
                self.sync_folder.display()
            );
            Ok(())
        }

        /// Connect to the sync root with minimal callbacks.
        pub fn connect(&mut self) -> Result<(), String> {
            let connection = Session::new()
                .connect(&self.sync_folder, MinimalFilter)
                .map_err(|e| format!("Connect error: {:?}", e))?;

            self._connection = Some(Box::new(connection));
            log::info!("[cloud] Connected to sync root");
            Ok(())
        }

        /// Mark a file as synced (green checkmark overlay).
        pub fn mark_in_sync(&self, path: &Path) -> Result<(), String> {
            if !path.exists() {
                return Ok(());
            }

            // Try to open as existing placeholder first
            match Placeholder::options().write_access().open(path) {
                Ok(mut placeholder) => {
                    // Check if it's already a placeholder
                    if placeholder.info().ok().flatten().is_some() {
                        placeholder.mark_in_sync(true, None).ok();
                    } else {
                        placeholder
                            .convert_to_placeholder(ConvertOptions::default().mark_in_sync(), None)
                            .ok();
                    }
                    Ok(())
                }
                Err(e) => {
                    log::debug!(
                        "[cloud] Can't open placeholder {}: {:?}",
                        path.display(),
                        e
                    );
                    Ok(()) // Non-fatal
                }
            }
        }

        /// Mark a file as not in sync / syncing (blue arrows overlay).
        pub fn mark_syncing(&self, path: &Path) -> Result<(), String> {
            if !path.exists() {
                return Ok(());
            }

            match Placeholder::options().write_access().open(path) {
                Ok(mut placeholder) => {
                    if placeholder.info().ok().flatten().is_some() {
                        placeholder.mark_in_sync(false, None).ok();
                    } else {
                        placeholder
                            .convert_to_placeholder(ConvertOptions::default(), None)
                            .ok();
                    }
                    Ok(())
                }
                Err(_) => Ok(()),
            }
        }

        /// Unregister the sync root.
        pub fn unregister(&self) -> Result<(), String> {
            let sync_root_id = SyncRootIdBuilder::new(PROVIDER_NAME)
                .user_security_id(
                    SecurityId::current_user().map_err(|e| format!("SID error: {:?}", e))?,
                )
                .build();

            sync_root_id
                .unregister()
                .map_err(|e| format!("Unregister error: {:?}", e))?;

            log::info!("[cloud] Sync root unregistered");
            Ok(())
        }
    }

    /// Minimal SyncFilter — all files are fully present.
    #[derive(Debug)]
    struct MinimalFilter;

    impl SyncFilter for MinimalFilter {
        fn fetch_data(
            &self,
            _request: Request,
            _ticket: ticket::FetchData,
            _info: info::FetchData,
        ) -> CResult<()> {
            Err(CloudErrorKind::NotSupported)
        }

        fn fetch_placeholders(
            &self,
            _request: Request,
            _ticket: ticket::FetchPlaceholders,
            _info: info::FetchPlaceholders,
        ) -> CResult<()> {
            Err(CloudErrorKind::NotSupported)
        }
    }
}

#[cfg(target_os = "windows")]
pub use inner::CloudProvider;

#[cfg(not(target_os = "windows"))]
pub struct CloudProvider;

#[cfg(not(target_os = "windows"))]
impl CloudProvider {
    pub fn new(_sync_folder: std::path::PathBuf) -> Self {
        Self
    }
    pub fn register(&self) -> Result<(), String> {
        Ok(())
    }
    pub fn connect(&mut self) -> Result<(), String> {
        Ok(())
    }
    pub fn mark_in_sync(&self, _path: &std::path::Path) -> Result<(), String> {
        Ok(())
    }
    pub fn mark_syncing(&self, _path: &std::path::Path) -> Result<(), String> {
        Ok(())
    }
    pub fn unregister(&self) -> Result<(), String> {
        Ok(())
    }
}
