use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
pub struct LiteCloudApi {
    client: Client,
    base_url: Arc<RwLock<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteFile {
    pub id: String,
    pub name: String,
    pub path: String,
    pub size: i64,
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
    #[serde(rename = "mimeType")]
    pub mime_type: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    pub encrypted: Option<bool>,
    #[serde(rename = "deletedAt")]
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct SyncResponse {
    pub files: Vec<RemoteFile>,
    #[serde(rename = "serverTime")]
    pub server_time: i64,
    #[serde(rename = "totalFiles")]
    pub total_files: usize,
}

impl LiteCloudApi {
    pub fn new() -> Self {
        let client = Client::builder()
            .cookie_store(true)
            .timeout(std::time::Duration::from_secs(300))
            .danger_accept_invalid_certs(false)
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: Arc::new(RwLock::new(String::new())),
        }
    }

    pub async fn set_base_url(&self, url: &str) {
        let mut base = self.base_url.write().await;
        *base = url.trim_end_matches('/').to_string();
    }

    async fn url(&self, path: &str) -> String {
        let base = self.base_url.read().await;
        format!("{}{}", base, path)
    }

    pub async fn login(&self, email: &str, password: &str) -> Result<serde_json::Value, String> {
        let url = self.url("/login").await;
        let form = [("email", email), ("password", password)];

        let resp = self
            .client
            .post(&url)
            .form(&form)
            .send()
            .await
            .map_err(|e| format!("Connection failed: {}", e))?;

        if !resp.status().is_success() && !resp.status().is_redirection() {
            return Err("Invalid credentials".to_string());
        }

        // The session cookie is automatically stored by reqwest's cookie store
        Ok(serde_json::json!({ "success": true }))
    }

    pub async fn get_full_file_list(&self) -> Result<SyncResponse, String> {
        let url = self.url("/api/sync/full").await;
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if resp.status() == 401 {
            return Err("Not authenticated".to_string());
        }

        resp.json::<SyncResponse>()
            .await
            .map_err(|e| format!("Parse error: {}", e))
    }

    pub async fn get_changes_since(&self, since: i64) -> Result<SyncResponse, String> {
        let url = self.url(&format!("/api/sync?since={}", since)).await;
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        resp.json::<SyncResponse>()
            .await
            .map_err(|e| format!("Parse error: {}", e))
    }

    pub async fn download_file(&self, file_id: &str, local_path: &Path) -> Result<(), String> {
        let url = self
            .url(&format!("/api/files/download?id={}", file_id))
            .await;
        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Download failed: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Download error: {}", resp.status()));
        }

        let bytes = resp
            .bytes()
            .await
            .map_err(|e| format!("Read error: {}", e))?;

        if let Some(parent) = local_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }

        std::fs::write(local_path, &bytes).map_err(|e| format!("Write error: {}", e))
    }

    pub async fn upload_file(
        &self,
        local_path: &Path,
        remote_path: &str,
    ) -> Result<serde_json::Value, String> {
        let url = self.url("/api/files/upload").await;
        let file_name = local_path
            .file_name()
            .unwrap_or_default()
            .to_str()
            .unwrap_or("file")
            .to_string();

        let bytes =
            std::fs::read(local_path).map_err(|e| format!("Read error: {}", e))?;

        let file_part = reqwest::multipart::Part::bytes(bytes)
            .file_name(file_name)
            .mime_str("application/octet-stream")
            .map_err(|e| format!("Mime error: {}", e))?;

        let form = reqwest::multipart::Form::new()
            .part("files", file_part)
            .text("path", remote_path.to_string())
            .text("encrypted", "0");

        let resp = self
            .client
            .post(&url)
            .multipart(form)
            .send()
            .await
            .map_err(|e| format!("Upload failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("Upload error {}: {}", status, body));
        }

        resp.json()
            .await
            .map_err(|e| format!("Parse error: {}", e))
    }

    pub async fn create_folder(
        &self,
        path: &str,
        name: &str,
    ) -> Result<serde_json::Value, String> {
        let url = self.url("/api/files/mkdir").await;
        let resp = self
            .client
            .post(&url)
            .json(&serde_json::json!({ "path": path, "name": name }))
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        resp.json()
            .await
            .map_err(|e| format!("Parse error: {}", e))
    }

    pub async fn delete_file(&self, file_id: &str) -> Result<(), String> {
        let url = self.url("/api/files/delete").await;
        self.client
            .delete(&url)
            .json(&serde_json::json!({ "ids": [file_id] }))
            .send()
            .await
            .map_err(|e| format!("Delete failed: {}", e))?;
        Ok(())
    }

    pub async fn health(&self) -> Result<bool, String> {
        let url = self.url("/api/health").await;
        match self.client.get(&url).send().await {
            Ok(resp) => Ok(resp.status().is_success()),
            Err(_) => Ok(false),
        }
    }
}
