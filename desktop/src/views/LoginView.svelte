<script lang="ts">
  import { login } from "../lib/api";
  import { currentView } from "../lib/stores.svelte";

  let serverUrl = $state("https://");
  let email = $state("");
  let password = $state("");
  let totpCode = $state("");
  let needsTotp = $state(false);
  let loading = $state(false);
  let error = $state("");

  async function handleLogin() {
    if (!serverUrl || !email || !password) return;
    loading = true;
    error = "";
    try {
      await login(serverUrl.replace(/\/+$/, ""), email, password, needsTotp ? totpCode : undefined);
      currentView.value = "setup";
    } catch (e: any) {
      if (typeof e === "string" && e.includes("totp")) {
        needsTotp = true;
        error = "";
      } else {
        error = typeof e === "string" ? e : e.message || "Anmeldung fehlgeschlagen";
      }
    } finally {
      loading = false;
    }
  }
</script>

<div class="container">
  <div class="logo">
    <svg viewBox="0 0 24 24" width="48" height="48" fill="var(--primary)">
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
    </svg>
    <h1>LiteCloud Sync</h1>
    <p class="subtitle">Mit deiner Cloud verbinden</p>
  </div>

  <form on:submit|preventDefault={handleLogin}>
    <label>
      <span>Server-URL</span>
      <input type="url" bind:value={serverUrl} placeholder="https://lite.example.com" required />
    </label>

    <label>
      <span>E-Mail</span>
      <input type="email" bind:value={email} placeholder="name@example.com" required />
    </label>

    <label>
      <span>Passwort</span>
      <input type="password" bind:value={password} required />
    </label>

    {#if needsTotp}
      <label>
        <span>2FA-Code</span>
        <input type="text" bind:value={totpCode} placeholder="000000" maxlength="6" inputmode="numeric" required />
      </label>
    {/if}

    {#if error}
      <div class="error">{error}</div>
    {/if}

    <button type="submit" disabled={loading}>
      {loading ? "Verbinde..." : "Anmelden"}
    </button>
  </form>
</div>

<style>
  .container { padding: 40px 32px; display: flex; flex-direction: column; height: 100vh; }
  .logo { text-align: center; margin-bottom: 32px; }
  .logo h1 { font-size: 20px; font-weight: 600; margin-top: 12px; }
  .subtitle { font-size: 13px; color: var(--on-surface-variant); margin-top: 4px; }
  form { display: flex; flex-direction: column; gap: 16px; }
  label { display: flex; flex-direction: column; gap: 4px; }
  label span { font-size: 12px; font-weight: 500; color: var(--on-surface-variant); }
  input {
    padding: 10px 14px; border: 1px solid var(--outline); border-radius: 8px;
    font-size: 14px; background: var(--surface); color: var(--on-surface);
    outline: none; transition: border-color 0.15s;
  }
  input:focus { border-color: var(--primary); }
  button {
    margin-top: 8px; padding: 12px; border: none; border-radius: 24px;
    background: var(--primary); color: var(--on-primary);
    font-size: 14px; font-weight: 500; cursor: pointer;
    transition: opacity 0.15s;
  }
  button:hover { opacity: 0.9; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .error {
    padding: 10px 14px; border-radius: 8px;
    background: color-mix(in srgb, var(--error) 15%, transparent);
    color: var(--error); font-size: 13px;
  }
</style>
