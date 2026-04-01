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
      } else {
        error = typeof e === "string" ? e : e.message || "Anmeldung fehlgeschlagen";
      }
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen flex flex-col justify-center px-8 py-6">
  <div class="flex flex-col items-center mb-8">
    <div class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
      <span class="material-symbols-outlined text-primary" style="font-size:32px">cloud</span>
    </div>
    <h1 class="text-lg font-semibold text-on-surface">LiteCloud Sync</h1>
    <p class="text-xs text-on-surface-variant mt-1">Mit deiner Cloud verbinden</p>
  </div>

  <form on:submit|preventDefault={handleLogin}>
    <div class="mb-4">
      <label for="server" class="m3-label">Server-URL</label>
      <input type="url" id="server" bind:value={serverUrl} placeholder="https://lite.example.com" required class="m3-input" />
    </div>

    <div class="mb-4">
      <label for="email" class="m3-label">E-Mail</label>
      <input type="email" id="email" bind:value={email} placeholder="name@example.com" required class="m3-input" />
    </div>

    <div class="mb-4">
      <label for="password" class="m3-label">Passwort</label>
      <input type="password" id="password" bind:value={password} required class="m3-input" />
    </div>

    {#if needsTotp}
      <div class="mb-4">
        <label for="totp" class="m3-label">2FA-Code</label>
        <input type="text" id="totp" bind:value={totpCode} placeholder="000000" maxlength="6" inputmode="numeric" required
          class="m3-input text-center tracking-[0.3em] font-mono" />
      </div>
    {/if}

    {#if error}
      <div class="text-xs text-error bg-error-container/30 rounded-lg px-3 py-2.5 flex items-center gap-2 mb-4">
        <span class="material-symbols-outlined" style="font-size:16px">error</span>
        {error}
      </div>
    {/if}

    <button type="submit" disabled={loading} class="desktop-btn-primary mt-2">
      {loading ? "Verbinde..." : "Anmelden"}
    </button>
  </form>
</div>
