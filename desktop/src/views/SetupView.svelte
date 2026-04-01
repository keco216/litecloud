<script lang="ts">
  import { selectSyncFolder, startSync } from "../lib/api";
  import { currentView } from "../lib/stores.svelte";

  let syncFolder = $state("");
  let loading = $state(false);
  let error = $state("");

  async function chooseFoler() {
    try {
      const path = await selectSyncFolder();
      if (path) syncFolder = path;
    } catch (e: any) {
      error = typeof e === "string" ? e : "Ordner konnte nicht ausgewählt werden";
    }
  }

  async function finish() {
    if (!syncFolder) return;
    loading = true;
    error = "";
    try {
      await startSync();
      currentView.value = "main";
    } catch (e: any) {
      error = typeof e === "string" ? e : "Sync konnte nicht gestartet werden";
    } finally {
      loading = false;
    }
  }
</script>

<div class="container">
  <div class="icon">
    <svg viewBox="0 0 24 24" width="64" height="64" fill="var(--primary)">
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
  </div>

  <h2>Sync-Ordner wählen</h2>
  <p class="desc">Dateien in diesem Ordner werden mit deiner LiteCloud synchronisiert.</p>

  <div class="folder-picker">
    <input type="text" bind:value={syncFolder} placeholder="C:\Users\...\LiteCloud" readonly />
    <button class="outline" on:click={chooseFoler}>Durchsuchen...</button>
  </div>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <button class="primary" on:click={finish} disabled={!syncFolder || loading}>
    {loading ? "Wird eingerichtet..." : "Synchronisierung starten"}
  </button>
</div>

<style>
  .container { padding: 48px 32px; display: flex; flex-direction: column; align-items: center; height: 100vh; }
  .icon { margin-bottom: 24px; }
  h2 { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
  .desc { font-size: 13px; color: var(--on-surface-variant); text-align: center; margin-bottom: 32px; max-width: 320px; }
  .folder-picker { display: flex; gap: 8px; width: 100%; margin-bottom: 16px; }
  .folder-picker input { flex: 1; padding: 10px 14px; border: 1px solid var(--outline); border-radius: 8px; font-size: 13px; background: var(--surface-container); color: var(--on-surface); }
  .outline { padding: 10px 16px; border: 1px solid var(--primary); border-radius: 8px; background: transparent; color: var(--primary); font-size: 13px; cursor: pointer; white-space: nowrap; }
  .primary { width: 100%; margin-top: 16px; padding: 12px; border: none; border-radius: 24px; background: var(--primary); color: var(--on-primary); font-size: 14px; font-weight: 500; cursor: pointer; }
  .primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .error { padding: 10px 14px; border-radius: 8px; background: color-mix(in srgb, var(--error) 15%, transparent); color: var(--error); font-size: 13px; width: 100%; }
</style>
