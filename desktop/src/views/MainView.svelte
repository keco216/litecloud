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

  const statusConfig: Record<string, { label: string; icon: string; color: string; bg: string }> = {
    idle:    { label: "Alles synchronisiert", icon: "check_circle", color: "text-primary", bg: "bg-primary/10" },
    syncing: { label: "Synchronisiere...",    icon: "sync",         color: "text-primary", bg: "bg-primary/10" },
    error:   { label: "Sync-Fehler",         icon: "error",        color: "text-error",   bg: "bg-error/10" },
    offline: { label: "Offline",             icon: "cloud_off",    color: "text-on-surface-variant", bg: "bg-surface-container-high" },
    paused:  { label: "Pausiert",            icon: "pause_circle", color: "text-on-surface-variant", bg: "bg-surface-container-high" },
  };

  const actionIcons: Record<string, { icon: string; color: string }> = {
    uploaded:   { icon: "cloud_upload",   color: "text-primary" },
    downloaded: { icon: "cloud_download", color: "text-primary" },
    deleted:    { icon: "delete",         color: "text-on-surface-variant" },
    conflict:   { icon: "warning",        color: "text-error" },
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
    try { activities = await getRecentActivity(10); } catch {}
  }

  onMount(() => {
    refresh();
    polling = setInterval(refresh, 3000);
    return () => clearInterval(polling);
  });

  async function handleSyncNow() { try { await syncNow(); } catch {} refresh(); }
  async function openFolder() { try { await invoke("open_sync_folder"); } catch {} }
  async function handleLogout() { try { await doLogout(); } catch {} currentView.value = "login"; }

  const cfg = $derived(statusConfig[syncStatus.status] || statusConfig.idle);
</script>

<div class="min-h-screen flex flex-col px-6 py-5">
  <!-- Status Card -->
  <div class="bg-surface-container rounded-2xl p-5 mb-5">
    <div class="flex items-center gap-4">
      <div class="w-12 h-12 rounded-full {cfg.bg} flex items-center justify-center flex-shrink-0">
        <span class="material-symbols-outlined {cfg.color}" style="font-size:28px"
          class:animate-spin={syncStatus.status === 'syncing'}>{cfg.icon}</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-[15px] font-semibold text-on-surface">{cfg.label}</p>
        {#if syncStatus.lastSync}
          <p class="text-xs text-on-surface-variant mt-0.5">Letzter Sync: {timeAgo(syncStatus.lastSync)}</p>
        {/if}
      </div>
    </div>

    {#if syncStatus.storageQuota > 0}
      {@const pct = Math.min(100, Math.round((syncStatus.storageUsed / syncStatus.storageQuota) * 100))}
      <div class="mt-4 pt-4 border-t border-outline-variant/20">
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs text-on-surface-variant">Speicher</span>
          <span class="text-xs font-medium text-on-surface">{pct}%</span>
        </div>
        <div class="w-full h-2 rounded-full bg-surface-container-highest">
          <div class="h-2 rounded-full bg-primary transition-all duration-500" style="width: {pct}%"></div>
        </div>
        <p class="text-[11px] text-on-surface-variant mt-1.5">{formatSize(syncStatus.storageUsed)} von {formatSize(syncStatus.storageQuota)} belegt</p>
      </div>
    {/if}
  </div>

  <!-- Activity List -->
  <div class="flex-1 flex flex-col min-h-0 mb-5">
    <p class="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-3 px-1">Letzte Aktivität</p>
    <div class="flex-1 overflow-y-auto">
      {#each activities as act}
        {@const ai = actionIcons[act.action] || { icon: "description", color: "text-on-surface-variant" }}
        <div class="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-surface-container-high/50 transition-colors cursor-default">
          <span class="material-symbols-outlined {ai.color} flex-shrink-0" style="font-size:20px">{ai.icon}</span>
          <span class="text-[13px] text-on-surface flex-1 truncate">{act.file_name}</span>
          <span class="text-[11px] text-on-surface-variant whitespace-nowrap flex-shrink-0">{timeAgo(act.timestamp)}</span>
        </div>
      {:else}
        <div class="flex flex-col items-center justify-center py-12 text-on-surface-variant">
          <span class="material-symbols-outlined opacity-20 mb-3" style="font-size:48px">cloud_done</span>
          <p class="text-sm">Noch keine Aktivität</p>
        </div>
      {/each}
    </div>
  </div>

  <!-- Action Buttons -->
  <div class="space-y-2.5 mb-4">
    <button on:click={handleSyncNow} class="desktop-btn-primary">
      <span class="material-symbols-outlined" style="font-size:18px">sync</span>
      Jetzt synchronisieren
    </button>
    <button on:click={openFolder} class="desktop-btn-outlined">
      <span class="material-symbols-outlined" style="font-size:18px">folder_open</span>
      Sync-Ordner öffnen
    </button>
  </div>

  <!-- Footer -->
  <div class="flex justify-between items-center pt-3 border-t border-outline-variant/20">
    <button on:click={() => currentView.value = "settings"}
      class="text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer bg-transparent border-none flex items-center gap-1.5 py-1">
      <span class="material-symbols-outlined" style="font-size:16px">settings</span>
      Einstellungen
    </button>
    <button on:click={handleLogout}
      class="text-xs text-on-surface-variant hover:text-error transition-colors cursor-pointer bg-transparent border-none flex items-center gap-1.5 py-1">
      <span class="material-symbols-outlined" style="font-size:16px">logout</span>
      Abmelden
    </button>
  </div>
</div>
