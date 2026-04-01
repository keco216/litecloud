<script lang="ts">
  import { currentView } from "../lib/stores.svelte";

  let autoStart = $state(true);
  let syncInterval = $state("30");
  let conflictStrategy = $state("keep_both");
</script>

<div class="container">
  <div class="header">
    <button class="back" on:click={() => currentView.value = "main"}>← Zurück</button>
    <h2>Einstellungen</h2>
  </div>

  <div class="settings">
    <div class="setting">
      <label>Sync-Intervall</label>
      <select bind:value={syncInterval}>
        <option value="0">Echtzeit</option>
        <option value="30">30 Sekunden</option>
        <option value="60">1 Minute</option>
        <option value="300">5 Minuten</option>
        <option value="900">15 Minuten</option>
        <option value="-1">Manuell</option>
      </select>
    </div>

    <div class="setting">
      <label>Bei Windows-Start automatisch starten</label>
      <input type="checkbox" bind:checked={autoStart} />
    </div>

    <div class="setting">
      <label>Konflikt-Strategie</label>
      <select bind:value={conflictStrategy}>
        <option value="ask">Immer fragen</option>
        <option value="keep_local">Lokale Version behalten</option>
        <option value="keep_remote">Server-Version behalten</option>
        <option value="keep_both">Beide behalten (Kopie)</option>
      </select>
    </div>
  </div>

  <div class="info">
    <p>LiteCloud Sync v1.0.0</p>
  </div>
</div>

<style>
  .container { padding: 24px; display: flex; flex-direction: column; height: 100vh; }
  .header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
  .back { background: none; border: none; color: var(--primary); font-size: 14px; cursor: pointer; padding: 4px; }
  h2 { font-size: 18px; font-weight: 600; }
  .settings { display: flex; flex-direction: column; gap: 20px; flex: 1; }
  .setting { display: flex; justify-content: space-between; align-items: center; }
  .setting label { font-size: 13px; flex: 1; }
  .setting select { padding: 6px 10px; border: 1px solid var(--outline); border-radius: 8px; font-size: 13px; background: var(--surface); color: var(--on-surface); }
  .setting input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--primary); }
  .info { text-align: center; padding-top: 16px; border-top: 1px solid var(--surface-container); }
  .info p { font-size: 11px; color: var(--on-surface-variant); }
</style>
