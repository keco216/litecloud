<script lang="ts">
  import { login } from "../lib/api";
  import { currentView } from "../lib/stores.svelte";

  let serverUrl = $state("https://");
  let email = $state("");
  let password = $state("");
  let showPw = $state(false);
  let totpCode = $state("");
  let needsTotp = $state(false);
  let loading = $state(false);
  let error = $state("");

  async function handleLogin(e: Event) {
    e.preventDefault();
    if (!serverUrl || !email || !password) return;
    loading = true; error = "";
    try {
      await login(serverUrl.replace(/\/+$/, ""), email, password, needsTotp ? totpCode : undefined);
      currentView.value = "setup";
    } catch (err: any) {
      if (typeof err === "string" && err.includes("totp")) { needsTotp = true; }
      else { error = typeof err === "string" ? err : err.message || "Anmeldung fehlgeschlagen"; }
    } finally { loading = false; }
  }
</script>

<div class="view">
  <div class="header">
    <div class="logo">
      <span class="material-symbols-outlined" style="font-size:32px;color:var(--color-on-primary-container)">cloud</span>
    </div>
    <h1 class="m3-headline-small">LiteCloud Sync</h1>
    <p class="m3-body-medium" style="color:var(--color-on-surface-variant)">Mit deiner Cloud verbinden</p>
  </div>

  <form class="form" onsubmit={handleLogin}>
    <div class="field">
      <label class="m3-label">Server-URL</label>
      <input class="m3-input" type="url" bind:value={serverUrl} placeholder="https://lite.example.com" required />
    </div>
    <div class="field">
      <label class="m3-label">E-Mail</label>
      <input class="m3-input" type="email" bind:value={email} placeholder="name@example.com" required />
    </div>
    <div class="field">
      <label class="m3-label">Passwort</label>
      <div class="input-wrap">
        <input class="m3-input" type={showPw ? 'text' : 'password'} bind:value={password} required style="padding-right:48px" />
        <button type="button" class="m3-icon-btn eye-btn" onclick={() => showPw = !showPw}>
          <span class="material-symbols-outlined" style="font-size:20px">{showPw ? 'visibility_off' : 'visibility'}</span>
        </button>
      </div>
    </div>

    {#if needsTotp}
      <div class="field">
        <label class="m3-label">2FA-Code</label>
        <input class="m3-input" type="text" bind:value={totpCode} placeholder="000000" maxlength="6" inputmode="numeric" required style="text-align:center;letter-spacing:0.3em;font-family:monospace;font-size:18px" />
      </div>
    {/if}

    {#if error}
      <div class="error-banner">
        <span class="material-symbols-outlined" style="font-size:18px;color:var(--color-error)">error</span>
        <span class="m3-body-small" style="color:var(--color-error)">{error}</span>
      </div>
    {/if}

    <button type="submit" class="m3-btn m3-btn-filled w-full" disabled={loading} style="margin-top:8px">
      {#if loading}<span class="material-symbols-outlined animate-spin" style="font-size:18px">progress_activity</span>{/if}
      {loading ? "Verbinde..." : "Anmelden"}
    </button>
  </form>

  <span class="m3-label-small" style="color:var(--color-outline);text-align:right;margin-top:auto;padding-top:16px">v1.0.0</span>
</div>

<style>
  .view { display: flex; flex-direction: column; padding: 24px; height: 100vh; background: var(--color-surface); }
  .header { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0 32px; }
  .logo { width: 56px; height: 56px; border-radius: var(--m3-shape-md); background: var(--color-primary-container); display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
  .form { display: flex; flex-direction: column; gap: 16px; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .input-wrap { position: relative; }
  .eye-btn { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; }
  .error-banner { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: var(--m3-shape-md); background: var(--color-error-container); }
</style>
