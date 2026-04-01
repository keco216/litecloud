<script lang="ts">
  import { syncNow, getSyncStatus, getRecentActivity, logout as doLogout } from "../lib/api";
  import { currentView, syncStatus } from "../lib/stores.svelte";
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";

  let activities = $state<Array<{ action: string; file_name: string; timestamp: number }>>([]);
  let polling: ReturnType<typeof setInterval> | undefined;

  function formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    return (bytes / 1073741824).toFixed(1) + " GB";
  }

  function timeAgo(ts: number): string {
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return "gerade eben";
    if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`;
    if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std`;
    return `vor ${Math.floor(diff / 86400)} Tagen`;
  }

  const statusLabels: Record<string, string> = {
    idle: "Alles synchronisiert",
    syncing: "Synchronisiere...",
    error: "Sync-Fehler",
    offline: "Offline",
    paused: "Pausiert",
  };

  const statusIcons: Record<string, string> = {
    idle: "✓", syncing: "↻", error: "✗", offline: "○", paused: "⏸",
  };

  const actionIcons: Record<string, string> = {
    uploaded: "↑", downloaded: "↓", deleted: "✕", conflict: "⚠",
  };

  async function refresh() {
    try {
      const s = await getSyncStatus();
      syncStatus.status = s.status as any;
      syncStatus.progress = s.progress;
      syncStatus.lastSync = s.last_sync;
      syncStatus.filesSynced = s.files_synced;
      syncStatus.pendingChanges = s.pending_changes;
      syncStatus.conflicts = s.conflicts;
      syncStatus.error = s.error;
      syncStatus.storageUsed = s.storage_used;
      syncStatus.storageQuota = s.storage_quota;
    } catch {}
    try {
      activities = await getRecentActivity(10);
    } catch {}
  }

  onMount(() => {
    refresh();
    polling = setInterval(refresh, 3000);
    return () => clearInterval(polling);
  });

  async function handleSyncNow() {
    try { await syncNow(); } catch {}
    refresh();
  }

  async function openFolder() {
    try { await invoke("open_sync_folder"); } catch {}
  }

  async function handleLogout() {
    try { await doLogout(); } catch {}
    currentView.value = "login";
  }
</script>

<div class="container">
  <!-- Status Header -->
  <div class="status-header">
    <div class="status-icon {syncStatus.status}">{statusIcons[syncStatus.status] || "?"}</div>
    <div>
      <div class="status-text">{statusLabels[syncStatus.status] || syncStatus.status}</div>
      {#if syncStatus.lastSync}
        <div class="status-sub">Letzter Sync: {timeAgo(syncStatus.lastSync)}</div>
      {/if}
      {#if syncStatus.error}
        <div class="status-error">{syncStatus.error}</div>
      {/if}
    </div>
  </div>

  <!-- Storage Bar -->
  {#if syncStatus.storageQuota > 0}
    {@const pct = Math.min(100, Math.round((syncStatus.storageUsed / syncStatus.storageQuota) * 100))}
    <div class="storage">
      <div class="storage-bar">
        <div class="storage-fill" style="width: {pct}%"></div>
      </div>
      <div class="storage-text">{formatSize(syncStatus.storageUsed)} / {formatSize(syncStatus.storageQuota)}</div>
    </div>
  {/if}

  <!-- Recent Activity -->
  <div class="section-title">Letzte Aktivität</div>
  <div class="activity-list">
    {#each activities as act}
      <div class="activity-item">
        <span class="act-icon {act.action}">{actionIcons[act.action] || "·"}</span>
        <span class="act-name">{act.file_name}</span>
        <span class="act-time">{timeAgo(act.timestamp)}</span>
      </div>
    {:else}
      <div class="empty">Noch keine Aktivität</div>
    {/each}
  </div>

  <!-- Actions -->
  <div class="actions">
    <button class="primary" on:click={handleSyncNow}>Jetzt synchronisieren</button>
    <button class="outline" on:click={openFolder}>Sync-Ordner öffnen</button>
  </div>

  <div class="footer">
    <button class="link" on:click={() => currentView.value = "settings"}>⚙ Einstellungen</button>
    <button class="link danger" on:click={handleLogout}>Abmelden</button>
  </div>
</div>

<style>
  .container { padding: 24px; display: flex; flex-direction: column; height: 100vh; gap: 16px; }
  .status-header { display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--surface-container); border-radius: 16px; }
  .status-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 600; }
  .status-icon.idle { background: #e8f5e9; color: #2e7d32; }
  .status-icon.syncing { background: #e3f2fd; color: #1565c0; }
  .status-icon.error { background: #fce4ec; color: #c62828; }
  .status-icon.offline { background: #f5f5f5; color: #757575; }
  .status-icon.paused { background: #fff8e1; color: #f57f17; }
  .status-text { font-weight: 600; font-size: 15px; }
  .status-sub { font-size: 12px; color: var(--on-surface-variant); margin-top: 2px; }
  .status-error { font-size: 12px; color: var(--error); margin-top: 2px; }
  .storage { margin-top: -4px; }
  .storage-bar { height: 6px; border-radius: 3px; background: var(--surface-container); overflow: hidden; }
  .storage-fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.3s; }
  .storage-text { font-size: 11px; color: var(--on-surface-variant); margin-top: 4px; }
  .section-title { font-size: 12px; font-weight: 600; color: var(--on-surface-variant); text-transform: uppercase; letter-spacing: 0.5px; }
  .activity-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; }
  .activity-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
  .activity-item:hover { background: var(--surface-container); }
  .act-icon { width: 20px; text-align: center; font-weight: 600; }
  .act-icon.uploaded { color: #2e7d32; }
  .act-icon.downloaded { color: #1565c0; }
  .act-icon.deleted { color: #757575; }
  .act-icon.conflict { color: #f57f17; }
  .act-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .act-time { font-size: 11px; color: var(--on-surface-variant); white-space: nowrap; }
  .empty { text-align: center; color: var(--on-surface-variant); padding: 24px; font-size: 13px; }
  .actions { display: flex; flex-direction: column; gap: 8px; }
  .primary { padding: 10px; border: none; border-radius: 24px; background: var(--primary); color: var(--on-primary); font-size: 13px; font-weight: 500; cursor: pointer; }
  .primary:hover { opacity: 0.9; }
  .outline { padding: 10px; border: 1px solid var(--outline); border-radius: 24px; background: transparent; color: var(--on-surface); font-size: 13px; cursor: pointer; }
  .footer { display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--surface-container); }
  .link { background: none; border: none; color: var(--on-surface-variant); font-size: 12px; cursor: pointer; padding: 4px; }
  .link:hover { color: var(--primary); }
  .link.danger:hover { color: var(--error); }
</style>
