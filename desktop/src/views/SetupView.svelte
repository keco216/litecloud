<script lang="ts">
  import { selectSyncFolder, startSync } from "../lib/api";
  import { currentView } from "../lib/stores.svelte";

  let syncFolder = $state("");
  let loading = $state(false);
  let error = $state("");

  async function chooseFolder() {
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

<div class="bg-surface-container-lowest min-h-screen flex flex-col">
  <main class="flex-grow flex items-center justify-center px-6">
    <div class="w-full max-w-[360px] flex flex-col items-center">
      <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <span class="material-symbols-outlined text-[36px] text-primary">folder</span>
      </div>

      <h2 class="m3-headline-small text-on-surface mb-2">Sync-Ordner wählen</h2>
      <p class="m3-body-small text-on-surface-variant text-center mb-8">
        Dateien in diesem Ordner werden mit deiner LiteCloud synchronisiert.
      </p>

      <div class="flex gap-2 w-full mb-4">
        <input type="text" bind:value={syncFolder} placeholder="C:\Users\...\LiteCloud" readonly class="m3-input !rounded-lg flex-1 !text-sm" />
        <button on:click={chooseFolder} class="m3-btn m3-btn-outlined !rounded-lg !h-12 !min-w-0 !px-4">
          <span class="material-symbols-outlined text-[20px]">folder_open</span>
        </button>
      </div>

      {#if error}
        <div class="m3-body-small text-error bg-error-container/30 rounded-xl px-4 py-3 flex items-center gap-2 w-full mb-4">
          <span class="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      {/if}

      <button on:click={finish} disabled={!syncFolder || loading} class="m3-btn m3-btn-filled w-full !h-11 !rounded-full">
        {loading ? "Wird eingerichtet..." : "Synchronisierung starten"}
      </button>
    </div>
  </main>
</div>
