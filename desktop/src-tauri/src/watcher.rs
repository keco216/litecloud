use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::time::{Duration, Instant};

/// Simplified event sent to the sync engine after debouncing.
#[derive(Debug, Clone)]
pub enum FileChangeEvent {
    Changed(Vec<PathBuf>),
}

/// File system watcher with 500ms debounce.
/// Groups rapid successive events into a single batch.
pub struct FileWatcher {
    _watcher: RecommendedWatcher,
}

impl FileWatcher {
    /// Start watching `sync_folder` recursively.
    /// Sends debounced `FileChangeEvent` on `tx`.
    pub fn start(
        sync_folder: PathBuf,
        tx: mpsc::Sender<FileChangeEvent>,
    ) -> Result<Self, String> {
        let debounce_ms = 500;
        let folder = sync_folder.clone();

        // Internal channel for raw events
        let (raw_tx, raw_rx) = mpsc::channel::<Vec<PathBuf>>();

        let mut watcher = notify::recommended_watcher(move |res: Result<Event, _>| {
            if let Ok(event) = res {
                let dominated: Vec<PathBuf> = event
                    .paths
                    .into_iter()
                    .filter(|p| !should_ignore(p))
                    .collect();

                if dominated.is_empty() {
                    return;
                }

                match event.kind {
                    EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {
                        let _ = raw_tx.send(dominated);
                    }
                    _ => {}
                }
            }
        })
        .map_err(|e| format!("Watcher init failed: {}", e))?;

        watcher
            .watch(&folder, RecursiveMode::Recursive)
            .map_err(|e| format!("Watch failed: {}", e))?;

        // Debounce thread: collects raw events, waits 500ms of silence, then sends batch
        std::thread::spawn(move || {
            let mut pending: Vec<PathBuf> = Vec::new();
            let mut last_event: Option<Instant> = None;

            loop {
                match raw_rx.recv_timeout(Duration::from_millis(100)) {
                    Ok(paths) => {
                        pending.extend(paths);
                        last_event = Some(Instant::now());
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        // Check if debounce period has elapsed
                        if let Some(last) = last_event {
                            if last.elapsed() >= Duration::from_millis(debounce_ms) && !pending.is_empty()
                            {
                                // Deduplicate paths
                                pending.sort();
                                pending.dedup();

                                let batch = std::mem::take(&mut pending);
                                log::debug!(
                                    "[watcher] Debounced batch: {} paths",
                                    batch.len()
                                );
                                let _ = tx.send(FileChangeEvent::Changed(batch));
                                last_event = None;
                            }
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => {
                        log::info!("[watcher] Channel closed, stopping debounce thread");
                        break;
                    }
                }
            }
        });

        log::info!(
            "[watcher] Watching {} with {}ms debounce",
            sync_folder.display(),
            debounce_ms
        );

        Ok(Self { _watcher: watcher })
    }
}

/// Check if a path should be ignored by the watcher
fn should_ignore(path: &Path) -> bool {
    let name = path
        .file_name()
        .unwrap_or_default()
        .to_str()
        .unwrap_or("");

    name.starts_with("~$")
        || name.starts_with('.')
        || name.ends_with(".tmp")
        || name.ends_with(".partial")
        || name.ends_with(".crdownload")
        || name == "Thumbs.db"
        || name == "desktop.ini"
        || name == ".DS_Store"
        || name == ".litecloud"
        || path.to_str().unwrap_or("").contains(".litecloud")
}
