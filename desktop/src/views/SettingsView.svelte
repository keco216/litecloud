<script lang="ts">
  import { currentView } from "../lib/stores.svelte";

  let syncInterval = $state("30");
  let autoStart = $state(true);
  let conflictStrategy = $state("keep_both");
  let excludeTemp = $state(true);
  let excludeSystem = $state(true);
  let maxFileSize = $state("0");
  let notifySync = $state(true);
  let notifyConflict = $state(true);
  let notifyError = $state(true);
</script>

<div class="view">
  <!-- Header -->
  <div class="header">
    <button class="m3-icon-btn" onclick={() => currentView.value = "main"}>
      <span class="material-symbols-outlined">arrow_back</span>
    </button>
    <h1 class="m3-title-medium">Einstellungen</h1>
  </div>

  <div class="sections">
    <!-- Sync -->
    <p class="section-label m3-label-medium">Synchronisierung</p>
    <div class="m3-card settings-card">
      <div class="settings-row">
        <span class="m3-body-medium">Intervall</span>
        <select class="m3-select" bind:value={syncInterval}>
          <option value="10">10 Sekunden</option>
          <option value="30">30 Sekunden</option>
          <option value="60">1 Minute</option>
          <option value="300">5 Minuten</option>
        </select>
      </div>
      <hr class="m3-divider" />
      <div class="settings-row">
        <span class="m3-body-medium">Autostart mit Windows</span>
        <button class="m3-switch" class:active={autoStart} onclick={() => autoStart = !autoStart}><div class="m3-switch-thumb"></div></button>
      </div>
      <hr class="m3-divider" />
      <div class="settings-row">
        <span class="m3-body-medium">Bei Konflikten</span>
        <select class="m3-select" bind:value={conflictStrategy}>
          <option value="keep_both">Beide behalten</option>
          <option value="keep_local">Lokal behalten</option>
          <option value="keep_remote">Server behalten</option>
          <option value="ask">Immer fragen</option>
        </select>
      </div>
    </div>

    <!-- Filters -->
    <p class="section-label m3-label-medium">Dateifilter</p>
    <div class="m3-card settings-card">
      <div class="settings-row">
        <div class="row-content">
          <span class="m3-body-medium">Temporäre Dateien</span>
          <span class="m3-label-small" style="color:var(--color-outline)">.tmp, ~$*, .partial</span>
        </div>
        <button class="m3-switch" class:active={excludeTemp} onclick={() => excludeTemp = !excludeTemp}><div class="m3-switch-thumb"></div></button>
      </div>
      <hr class="m3-divider" />
      <div class="settings-row">
        <div class="row-content">
          <span class="m3-body-medium">System-Dateien</span>
          <span class="m3-label-small" style="color:var(--color-outline)">Thumbs.db, desktop.ini</span>
        </div>
        <button class="m3-switch" class:active={excludeSystem} onclick={() => excludeSystem = !excludeSystem}><div class="m3-switch-thumb"></div></button>
      </div>
      <hr class="m3-divider" />
      <div class="settings-row">
        <span class="m3-body-medium">Max. Dateigröße</span>
        <select class="m3-select" bind:value={maxFileSize}>
          <option value="0">Kein Limit</option>
          <option value="50">50 MB</option>
          <option value="100">100 MB</option>
          <option value="500">500 MB</option>
        </select>
      </div>
    </div>

    <!-- Notifications -->
    <p class="section-label m3-label-medium">Benachrichtigungen</p>
    <div class="m3-card settings-card">
      <div class="settings-row">
        <span class="m3-body-medium">Sync abgeschlossen</span>
        <button class="m3-switch" class:active={notifySync} onclick={() => notifySync = !notifySync}><div class="m3-switch-thumb"></div></button>
      </div>
      <hr class="m3-divider" />
      <div class="settings-row">
        <span class="m3-body-medium">Bei Konflikten</span>
        <button class="m3-switch" class:active={notifyConflict} onclick={() => notifyConflict = !notifyConflict}><div class="m3-switch-thumb"></div></button>
      </div>
      <hr class="m3-divider" />
      <div class="settings-row">
        <span class="m3-body-medium">Bei Fehlern</span>
        <button class="m3-switch" class:active={notifyError} onclick={() => notifyError = !notifyError}><div class="m3-switch-thumb"></div></button>
      </div>
    </div>
  </div>

  <p class="m3-label-small" style="color:var(--color-outline);text-align:center;padding:24px 0 8px;flex-shrink:0">LiteCloud Sync v1.0.0</p>
</div>

<style>
  .view { display: flex; flex-direction: column; padding: 24px; height: 100vh; background: var(--color-surface); }
  .header { display: flex; align-items: center; gap: 8px; padding-bottom: 16px; flex-shrink: 0; }
  .sections { flex: 1; overflow-y: auto; }
  .section-label { color: var(--color-on-surface-variant); letter-spacing: 0.1em; text-transform: uppercase; padding: 20px 0 8px; }
  .section-label:first-child { padding-top: 0; }
  .settings-card { padding: 0; }
  .settings-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; min-height: 52px; gap: 12px; }
  .row-content { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
</style>
