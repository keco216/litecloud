import { invoke } from "@tauri-apps/api/core";

/** Tauri command wrappers */

export async function login(
  serverUrl: string,
  email: string,
  password: string,
  totpCode?: string
) {
  return invoke<{ id: string; email: string; storageUsed: number; storageQuota: number }>(
    "login",
    { serverUrl, email, password, totpCode }
  );
}

export async function selectSyncFolder() {
  return invoke<string>("select_sync_folder");
}

export async function startSync() {
  return invoke<void>("start_sync");
}

export async function togglePause() {
  return invoke<boolean>("toggle_pause");
}

export async function syncNow() {
  return invoke<void>("sync_now");
}

export async function getSyncStatus() {
  return invoke<{
    status: string;
    progress: number;
    last_sync: number | null;
    files_synced: number;
    pending_changes: number;
    conflicts: number;
    error: string | null;
    storage_used: number;
    storage_quota: number;
  }>("get_sync_status");
}

export async function getRecentActivity(limit = 20) {
  return invoke<Array<{ action: string; file_name: string; timestamp: number }>>(
    "get_recent_activity",
    { limit }
  );
}

export async function resolveConflict(fileId: string, resolution: string) {
  return invoke<void>("resolve_conflict", { fileId, resolution });
}

export async function logout() {
  return invoke<void>("logout");
}
