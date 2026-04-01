<script lang="ts">
  import { selectSyncFolder, startSync } from "../lib/api";
  import { currentView } from "../lib/stores.svelte";

  let syncFolder = $state("");
  let loading = $state(false);
  let error = $state("");

  async function chooseFolder() {
    try { const path = await selectSyncFolder(); if (path) syncFolder = path; }
    catch (e: any) { error = typeof e === "string" ? e : "Ordner konnte nicht ausgewählt werden"; }
  }

  async function finish() {
    if (!syncFolder) return;
    loading = true; error = "";
    try { await startSync(); currentView.value = "main"; }
    catch (e: any) { error = typeof e === "string" ? e : "Sync konnte nicht gestartet werden"; }
    finally { loading = false; }
  }
</script>

<div class="view">
  <div class="content">
    <div class="icon-box">
      <span class="material-symbols-outlined" style="font-size:36px;color:var(--color-on-primary-container)">folder</span>
    </div>
    <h2 class="m3-headline-small">Sync-Ordner wählen</h2>
    <p class="m3-body-medium" style="color:var(--color-on-surface-variant);text-align:center;max-width:300px">
      Wähle einen Ordner auf deinem Computer der mit LiteCloud synchronisiert wird.
    </p>

    <div class="folder-picker">
      <div class="folder-path m3-card">
        <span class="material-symbols-outlined" style="font-size:20px;color:var(--color-primary)">folder</span>
        <span class="m3-body-small path-text">{syncFolder || "Kein Ordner ausgewählt"}</span>
        <button class="m3-btn m3-btn-tonal" style="height:32px;padding:0 16px;min-width:0;font-size:12px" onclick={chooseFolder}>Ändern</button>
      </div>
    </div>

    <p class="m3-body-small" style="color:var(--color-on-surface-variant);text-align:center">
      Dateien in diesem Ordner werden automatisch synchronisiert.
    </p>

    {#if error}
      <div class="error-banner">
        <span class="material-symbols-outlined" style="font-size:18px;color:var(--color-error)">error</span>
        <span class="m3-body-small" style="color:var(--color-error)">{error}</span>
      </div>
    {/if}
  </div>

  <button class="m3-btn m3-btn-filled w-full" onclick={finish} disabled={!syncFolder || loading} style="flex-shrink:0">
    {loading ? "Wird eingerichtet..." : "Synchronisierung starten"}
  </button>
</div>

<style>
  .view { display: flex; flex-direction: column; padding: 24px; height: 100vh; background: var(--color-surface); }
  .content { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; }
  .icon-box { width: 64px; height: 64px; border-radius: var(--m3-shape-lg); background: var(--color-primary-container); display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
  .folder-picker { width: 100%; }
  .folder-path { display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 16px; }
  .path-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-on-surface); }
  .error-banner { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: var(--m3-shape-md); background: var(--color-error-container); width: 100%; }
</style>
