<script lang="ts">
  import { currentView } from "../lib/stores.svelte";

  // Sync
  let syncInterval = $state("30");
  let autoStart = $state(true);
  let conflictStrategy = $state("keep_both");

  // Filters
  let excludeTempFiles = $state(true);
  let excludeSystemFiles = $state(true);
  let excludeExecutables = $state(false);
  let customExtensions = $state("");
  let maxFileSize = $state("0");

  // Bandwidth
  let limitBandwidth = $state(false);
  let uploadLimitKB = $state(0);
  let downloadLimitKB = $state(0);

  // Notifications
  let notifyOnSync = $state(true);
  let notifyOnConflict = $state(true);
  let notifyOnError = $state(true);
</script>

<div class="min-h-screen flex flex-col px-6 py-5 overflow-y-auto">
  <!-- Header -->
  <div class="flex items-center gap-3 mb-5 flex-shrink-0">
    <button on:click={() => currentView.value = "main"}
      class="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer bg-transparent border-none text-on-surface-variant">
      <span class="material-symbols-outlined" style="font-size:20px">arrow_back</span>
    </button>
    <h2 class="text-base font-semibold text-on-surface">Einstellungen</h2>
  </div>

  <div class="space-y-3 flex-1">
    <!-- Sync -->
    <details class="settings-section" open>
      <summary class="settings-header">
        <span class="material-symbols-outlined" style="font-size:18px">sync</span>
        Synchronisierung
      </summary>
      <div class="settings-body">
        <div class="setting-row">
          <span class="setting-label">Intervall</span>
          <select bind:value={syncInterval} class="setting-select">
            <option value="0">Echtzeit</option>
            <option value="30">30 Sekunden</option>
            <option value="60">1 Minute</option>
            <option value="300">5 Minuten</option>
            <option value="-1">Manuell</option>
          </select>
        </div>
        <div class="setting-row">
          <span class="setting-label">Autostart mit Windows</span>
          <label class="toggle">
            <input type="checkbox" bind:checked={autoStart} />
            <div class="toggle-track"></div>
          </label>
        </div>
        <div class="setting-row">
          <span class="setting-label">Bei Konflikten</span>
          <select bind:value={conflictStrategy} class="setting-select">
            <option value="ask">Fragen</option>
            <option value="keep_local">Lokal behalten</option>
            <option value="keep_remote">Server behalten</option>
            <option value="keep_both">Beide behalten</option>
          </select>
        </div>
      </div>
    </details>

    <!-- Filters -->
    <details class="settings-section">
      <summary class="settings-header">
        <span class="material-symbols-outlined" style="font-size:18px">filter_alt</span>
        Dateifilter
      </summary>
      <div class="settings-body">
        <label class="setting-check"><input type="checkbox" bind:checked={excludeTempFiles} /> Temporäre Dateien (.tmp, ~$*)</label>
        <label class="setting-check"><input type="checkbox" bind:checked={excludeSystemFiles} /> Systemdateien (Thumbs.db, .DS_Store)</label>
        <label class="setting-check"><input type="checkbox" bind:checked={excludeExecutables} /> Programme (.exe, .msi, .bat)</label>
        <div class="mt-3">
          <span class="text-[11px] text-on-surface-variant">Zusätzlich ausschließen:</span>
          <input type="text" bind:value={customExtensions} placeholder=".iso, .vmdk, .log" class="m3-input mt-1" />
        </div>
        <div class="mt-3">
          <span class="text-[11px] text-on-surface-variant">Max. Dateigröße:</span>
          <select bind:value={maxFileSize} class="setting-select mt-1 w-full">
            <option value="0">Kein Limit</option>
            <option value="52428800">50 MB</option>
            <option value="104857600">100 MB</option>
            <option value="524288000">500 MB</option>
            <option value="1073741824">1 GB</option>
          </select>
        </div>
      </div>
    </details>

    <!-- Bandwidth -->
    <details class="settings-section">
      <summary class="settings-header">
        <span class="material-symbols-outlined" style="font-size:18px">speed</span>
        Bandbreite
      </summary>
      <div class="settings-body">
        <div class="setting-row">
          <span class="setting-label">Begrenzen</span>
          <label class="toggle">
            <input type="checkbox" bind:checked={limitBandwidth} />
            <div class="toggle-track"></div>
          </label>
        </div>
        {#if limitBandwidth}
          <div class="grid grid-cols-2 gap-3 mt-2">
            <div>
              <span class="text-[11px] text-on-surface-variant">Upload (KB/s)</span>
              <input type="number" bind:value={uploadLimitKB} min="0" step="100" placeholder="0" class="m3-input mt-1" />
            </div>
            <div>
              <span class="text-[11px] text-on-surface-variant">Download (KB/s)</span>
              <input type="number" bind:value={downloadLimitKB} min="0" step="100" placeholder="0" class="m3-input mt-1" />
            </div>
          </div>
          <p class="text-[10px] text-on-surface-variant/60 mt-1">0 = unbegrenzt</p>
        {/if}
      </div>
    </details>

    <!-- Notifications -->
    <details class="settings-section">
      <summary class="settings-header">
        <span class="material-symbols-outlined" style="font-size:18px">notifications</span>
        Benachrichtigungen
      </summary>
      <div class="settings-body">
        <label class="setting-check"><input type="checkbox" bind:checked={notifyOnSync} /> Nach Sync</label>
        <label class="setting-check"><input type="checkbox" bind:checked={notifyOnConflict} /> Bei Konflikten</label>
        <label class="setting-check"><input type="checkbox" bind:checked={notifyOnError} /> Bei Fehlern</label>
      </div>
    </details>
  </div>

  <!-- Footer -->
  <div class="pt-3 mt-3 border-t border-outline-variant/20 text-center flex-shrink-0">
    <p class="text-[11px] text-on-surface-variant/60">LiteCloud Sync v1.0.0</p>
  </div>
</div>

<style>
  .settings-section {
    background: var(--color-surface-container);
    border-radius: 16px;
    overflow: hidden;
  }
  .settings-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-on-surface);
    cursor: pointer;
    list-style: none;
    user-select: none;
  }
  .settings-header::-webkit-details-marker { display: none; }
  .settings-header::after {
    content: '';
    margin-left: auto;
    width: 0; height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid var(--color-on-surface-variant);
    transition: transform 150ms;
  }
  details[open] > .settings-header::after { transform: rotate(180deg); }
  .settings-body {
    padding: 0 16px 14px;
  }
  .setting-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0;
  }
  .setting-label {
    font-size: 13px;
    color: var(--color-on-surface);
  }
  .setting-select {
    padding: 4px 8px;
    border-radius: 8px;
    border: 1px solid var(--color-outline-variant);
    background: var(--color-surface-container-lowest);
    color: var(--color-on-surface);
    font-size: 12px;
    outline: none;
    cursor: pointer;
  }
  .setting-check {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 13px;
    color: var(--color-on-surface);
    cursor: pointer;
  }
  .setting-check input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--color-primary);
    cursor: pointer;
  }

  /* Toggle switch */
  .toggle {
    position: relative;
    display: inline-flex;
    cursor: pointer;
    flex-shrink: 0;
  }
  .toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
  .toggle-track {
    width: 44px;
    height: 24px;
    border-radius: 12px;
    background: var(--color-surface-container-highest);
    position: relative;
    transition: background 150ms;
  }
  .toggle-track::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--color-outline);
    transition: transform 150ms, background 150ms;
  }
  .toggle input:checked + .toggle-track {
    background: var(--color-primary);
  }
  .toggle input:checked + .toggle-track::after {
    transform: translateX(20px);
    background: var(--color-on-primary);
  }
</style>
