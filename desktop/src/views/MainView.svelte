<script lang="ts">
  import { syncNow, getSyncStatus, getRecentActivity, logout as doLogout } from "../lib/api";
  import { currentView, syncStatus } from "../lib/stores.svelte";
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";

  let activities = $state<Array<{ action: string; file_name: string; timestamp: number }>>([]);
  let polling: ReturnType<typeof setInterval> | undefined;

  function formatSize(b: number): string {
    if (b < 1024) return b + " B";
    if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
    if (b < 1073741824) return (b / 1048576).toFixed(1) + " MB";
    return (b / 1073741824).toFixed(1) + " GB";
  }

  function timeAgo(ts: number): string {
    const diff = Math.floor(Date.now() / 1000) - ts;
    if (diff < 60) return "gerade eben";
    if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min`;
    if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std`;
    return `vor ${Math.floor(diff / 86400)} Tagen`;
  }

  const statusMap: Record<string, { label: string; icon: string; iconColor: string; bgColor: string }> = {
    idle:    { label: "Alles synchronisiert", icon: "check_circle",  iconColor: "#4caf50", bgColor: "rgba(76,175,80,0.12)" },
    syncing: { label: "Synchronisiere...",    icon: "sync",          iconColor: "var(--color-primary)", bgColor: "var(--color-primary-container)" },
    error:   { label: "Sync-Fehler",          icon: "error",         iconColor: "var(--color-error)", bgColor: "var(--color-error-container)" },
    offline: { label: "Offline",              icon: "cloud_off",     iconColor: "var(--color-outline)", bgColor: "var(--color-surface-container-highest)" },
    paused:  { label: "Pausiert",             icon: "pause_circle",  iconColor: "var(--color-outline)", bgColor: "var(--color-surface-container-highest)" },
  };

  const actionMap: Record<string, { icon: string; color: string; bg: string }> = {
    uploaded:   { icon: "upload",   color: "var(--color-on-primary-container)", bg: "var(--color-primary-container)" },
    downloaded: { icon: "download", color: "#4caf50", bg: "rgba(76,175,80,0.12)" },
    deleted:    { icon: "delete",   color: "var(--color-error)", bg: "var(--color-error-container)" },
    conflict:   { icon: "warning",  color: "#ffc107", bg: "rgba(255,193,7,0.12)" },
  };

  async function refresh() {
    try {
      const s = await getSyncStatus();
      syncStatus.status = s.status as any;
      syncStatus.progress = s.progress;
      syncStatus.lastSync = s.last_sync;
      syncStatus.storageUsed = s.storage_used;
      syncStatus.storageQuota = s.storage_quota;
    } catch {}
    try { activities = await getRecentActivity(15); } catch {}
  }

  onMount(() => { refresh(); polling = setInterval(refresh, 3000); return () => clearInterval(polling); });

  async function handleSync() { try { await syncNow(); } catch {} refresh(); }
  async function openFolder() { try { await invoke("open_sync_folder"); } catch {} }
  async function handleLogout() { try { await doLogout(); } catch {} currentView.value = "login"; }

  const cfg = $derived(statusMap[syncStatus.status] || statusMap.idle);
</script>

<div class="view">
  <!-- Status Card -->
  <div class="m3-card status-card">
    <div class="status-row">
      <div class="status-icon" style="background:{cfg.bgColor};color:{cfg.iconColor}">
        <span class="material-symbols-outlined" style="font-size:24px" class:animate-spin={syncStatus.status === 'syncing'}>{cfg.icon}</span>
      </div>
      <div>
        <p class="m3-title-small">{cfg.label}</p>
        {#if syncStatus.lastSync}
          <p class="m3-body-small" style="color:var(--color-on-surface-variant);margin-top:2px">Letzter Sync: {timeAgo(syncStatus.lastSync)}</p>
        {/if}
      </div>
    </div>

    {#if syncStatus.storageQuota > 0}
      {@const pct = Math.min(100, Math.round((syncStatus.storageUsed / syncStatus.storageQuota) * 100))}
      <div class="storage-section">
        <div class="storage-track"><div class="storage-fill" style="width:{pct}%"></div></div>
        <p class="m3-label-small" style="color:var(--color-on-surface-variant)">{formatSize(syncStatus.storageUsed)} von {formatSize(syncStatus.storageQuota)} belegt</p>
      </div>
    {/if}
  </div>

  <!-- Activity -->
  <div class="activity-section">
    <p class="m3-label-medium section-label">Letzte Aktivität</p>
    <div class="activity-list">
      {#each activities as act}
        {@const a = actionMap[act.action] || actionMap.uploaded}
        <div class="activity-item">
          <div class="act-icon" style="background:{a.bg};color:{a.color}">
            <span class="material-symbols-outlined" style="font-size:16px">{a.icon}</span>
          </div>
          <span class="m3-body-small act-name">{act.file_name}</span>
          <span class="m3-label-small" style="color:var(--color-outline)">{timeAgo(act.timestamp)}</span>
        </div>
      {:else}
        <div class="empty-state">
          <span class="material-symbols-outlined" style="font-size:40px;color:var(--color-outline);opacity:0.4">sync</span>
          <p class="m3-body-small" style="color:var(--color-on-surface-variant)">Noch keine Aktivität</p>
        </div>
      {/each}
    </div>
  </div>

  <!-- Actions -->
  <div class="actions">
    <button class="m3-btn m3-btn-filled w-full" onclick={handleSync}>
      <span class="material-symbols-outlined" style="font-size:18px">sync</span>
      Jetzt synchronisieren
    </button>
    <button class="m3-btn m3-btn-outlined w-full" onclick={openFolder}>
      <span class="material-symbols-outlined" style="font-size:18px">folder_open</span>
      Sync-Ordner öffnen
    </button>
  </div>

  <!-- Footer -->
  <div class="footer">
    <button class="m3-btn m3-btn-text" style="min-width:0;padding:0 8px;height:32px;font-size:12px" onclick={() => currentView.value = "settings"}>
      <span class="material-symbols-outlined" style="font-size:16px">settings</span>
      Einstellungen
    </button>
    <button class="m3-btn m3-btn-text" style="min-width:0;padding:0 8px;height:32px;font-size:12px;color:var(--color-on-surface-variant)" onclick={handleLogout}>
      Abmelden
    </button>
  </div>
</div>

<style>
  .view { display: flex; flex-direction: column; padding: 24px; height: 100vh; background: var(--color-surface); }

  .status-card { margin-bottom: 20px; }
  .status-row { display: flex; align-items: center; gap: 16px; }
  .status-icon { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .storage-section { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-outline-variant); display: flex; flex-direction: column; gap: 6px; }
  .storage-track { height: 4px; border-radius: 2px; background: var(--color-surface-container-highest); }
  .storage-fill { height: 100%; border-radius: 2px; background: var(--color-primary); transition: width 300ms var(--m3-ease); }

  .activity-section { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  .section-label { color: var(--color-on-surface-variant); letter-spacing: 0.1em; text-transform: uppercase; padding-bottom: 8px; }
  .activity-list { flex: 1; overflow-y: auto; }
  .activity-item { display: flex; align-items: center; gap: 12px; padding: 10px 8px; border-radius: var(--m3-shape-sm); min-height: 44px; transition: background 150ms; }
  .activity-item:hover { background: var(--color-surface-container-high); }
  .act-icon { width: 32px; height: 32px; border-radius: var(--m3-shape-sm); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .act-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty-state { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0; }

  .actions { display: flex; flex-direction: column; gap: 8px; padding-top: 16px; border-top: 1px solid var(--color-outline-variant); margin-top: auto; }
  .footer { display: flex; justify-content: space-between; padding-top: 8px; }
</style>
