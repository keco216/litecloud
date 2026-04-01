use std::time::{Duration, Instant};
use tokio::time::sleep;

/// Rate limiter for upload and download bandwidth.
/// Set limits to 0 for unlimited.
pub struct BandwidthLimiter {
    upload_bps: u64,
    download_bps: u64,
}

impl BandwidthLimiter {
    pub fn new(upload_kbps: u64, download_kbps: u64) -> Self {
        Self {
            upload_bps: upload_kbps * 1024,
            download_bps: download_kbps * 1024,
        }
    }

    pub fn unlimited() -> Self {
        Self {
            upload_bps: 0,
            download_bps: 0,
        }
    }

    /// Wait if we're transferring faster than the limit allows.
    /// Call after each chunk transfer with cumulative bytes and start time.
    pub async fn throttle_upload(&self, start: Instant, total_bytes: u64) {
        self.throttle(self.upload_bps, start, total_bytes).await;
    }

    pub async fn throttle_download(&self, start: Instant, total_bytes: u64) {
        self.throttle(self.download_bps, start, total_bytes).await;
    }

    async fn throttle(&self, limit_bps: u64, start: Instant, total_bytes: u64) {
        if limit_bps == 0 || total_bytes == 0 {
            return;
        }

        let elapsed = start.elapsed().as_secs_f64();
        let expected = total_bytes as f64 / limit_bps as f64;

        if expected > elapsed {
            let delay = Duration::from_secs_f64(expected - elapsed);
            // Cap delay to prevent stalls
            if delay < Duration::from_secs(5) {
                sleep(delay).await;
            }
        }
    }
}
