<script lang="ts">
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();

	let totpEnabled = $state(false);
	$effect(() => { totpEnabled = data.totpEnabled; });
	let qrCode = $state(''); let secretKey = $state(''); let verifyCode = $state('');
	let setupLoading = $state(false); let verifyError = $state(''); let showSetup = $state(false);

	// Theme switcher
	type ThemeMode = 'system' | 'light' | 'dark';
	let themeMode: ThemeMode = $state((browser && localStorage.getItem('lc-theme') as ThemeMode) || 'system');

	function applyTheme(mode: ThemeMode) {
		themeMode = mode;
		if (browser) {
			localStorage.setItem('lc-theme', mode);
			if (mode === 'dark') {
				document.documentElement.classList.add('dark-override');
				document.documentElement.classList.remove('light-override');
			} else if (mode === 'light') {
				document.documentElement.classList.add('light-override');
				document.documentElement.classList.remove('dark-override');
			} else {
				document.documentElement.classList.remove('dark-override', 'light-override');
			}
		}
	}

	// Apply saved theme on mount
	$effect(() => { if (browser) applyTheme(themeMode); });

	type Backup = { name: string; size: number; date: string; type: string };
	let backups: Backup[] = $state([]); let backupLoading = $state(false);
	async function loadBackups() { const r = await fetch('/api/backup'); if (r.ok) backups = (await r.json()).backups; }
	function fmtSize(b: number) { return b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; }
	$effect(() => { loadBackups(); });

	async function startSetup() { setupLoading = true; const r = await fetch('/api/auth/totp/setup', { method: 'POST' }); if (r.ok) { const d = await r.json(); qrCode = d.qr; secretKey = d.secret; showSetup = true; } setupLoading = false; }
	async function confirmSetup() { verifyError = ''; const r = await fetch('/api/auth/totp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: verifyCode, mode: 'setup' }) }); if (r.ok) { totpEnabled = true; showSetup = false; qrCode = ''; secretKey = ''; verifyCode = ''; } else { verifyError = 'Invalid code.'; verifyCode = ''; } }
	async function disable2FA() { if (!confirm('Disable 2FA?')) return; const r = await fetch('/api/auth/totp/disable', { method: 'POST' }); if (r.ok) totpEnabled = false; }
</script>

<svelte:head><title>Settings — LiteCloud</title></svelte:head>

<div class="px-8 py-2 max-w-2xl">
	<h2 class="m3-headline-small text-on-surface mb-6">Settings</h2>

	<!-- Appearance -->
	<div class="m3-card mb-4">
		<div class="flex items-center gap-3 mb-3">
			<span class="material-symbols-outlined text-primary">palette</span>
			<h3 class="m3-title-small text-on-surface">Appearance</h3>
		</div>
		<div class="m3-segmented w-full">
			{#each [
				{ mode: 'system' as ThemeMode, icon: 'brightness_auto', label: 'System' },
				{ mode: 'light' as ThemeMode, icon: 'light_mode', label: 'Light' },
				{ mode: 'dark' as ThemeMode, icon: 'dark_mode', label: 'Dark' }
			] as opt (opt.mode)}
				<button
					onclick={() => applyTheme(opt.mode)}
					class="m3-segmented-btn flex-1 {themeMode === opt.mode ? 'active' : ''}"
				>
					{#if themeMode === opt.mode}
						<span class="material-symbols-outlined" style="font-size: 18px;">check</span>
					{:else}
						<span class="material-symbols-outlined" style="font-size: 18px;">{opt.icon}</span>
					{/if}
					{opt.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Encryption -->
	<div class="m3-card mb-4">
		<div class="flex items-center gap-3 mb-2">
			<span class="material-symbols-outlined text-primary">lock</span>
			<h3 class="m3-title-small text-on-surface">End-to-End Encryption</h3>
		</div>
		{#if data.hasEncryption}
			<p class="text-sm text-on-surface-variant">Files encrypted with AES-256-GCM. The server cannot read your data.</p>
			<div class="mt-2 m3-chip !border-primary/30 !text-primary">
				<span class="material-symbols-outlined !text-[14px]">check_circle</span> Active
			</div>
		{:else}
			<p class="text-sm text-on-surface-variant">Re-login to activate encryption.</p>
		{/if}
	</div>

	<!-- 2FA -->
	<div class="m3-card mb-4">
		<div class="flex items-center gap-3 mb-2">
			<span class="material-symbols-outlined text-primary">security</span>
			<h3 class="m3-title-small text-on-surface">Two-Factor Authentication</h3>
		</div>

		{#if totpEnabled && !showSetup}
			<p class="text-sm text-on-surface-variant mb-3">2FA is active. You need your authenticator app to sign in.</p>
			<div class="flex items-center gap-3">
				<span class="m3-chip !border-primary/30 !text-primary"><span class="material-symbols-outlined !text-[14px]">check_circle</span> Enabled</span>
				<button onclick={disable2FA} class="m3-btn m3-btn-text !text-error !h-8 text-xs">Disable</button>
			</div>
		{:else if showSetup}
			<div class="space-y-4">
				<p class="text-sm text-on-surface-variant">Scan with your authenticator app:</p>
				<div class="flex justify-center">
					<img src={qrCode} alt="TOTP QR" class="w-48 h-48 rounded-xl" />
				</div>
				<details class="text-xs text-on-surface-variant">
					<summary class="cursor-pointer hover:text-on-surface">Can't scan?</summary>
					<code class="block mt-2 p-3 bg-surface-container rounded-xl font-mono text-[11px] break-all select-all">{secretKey}</code>
				</details>
				<div>
					<label class="m3-label">Verification code</label>
					<input type="text" bind:value={verifyCode} maxlength="6" inputmode="numeric" placeholder="000000"
						class="m3-input text-center text-lg font-mono tracking-widest"
						oninput={(e) => { verifyCode = (e.target as HTMLInputElement).value.replace(/\D/g, ''); }}
						onkeydown={(e) => { if (e.key === 'Enter') confirmSetup(); }} />
				</div>
				{#if verifyError}<div class="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3">{verifyError}</div>{/if}
				<div class="flex gap-2">
					<button onclick={confirmSetup} disabled={verifyCode.length !== 6} class="m3-btn m3-btn-filled flex-1">Verify & Enable</button>
					<button onclick={() => showSetup = false} class="m3-btn m3-btn-text">Cancel</button>
				</div>
			</div>
		{:else}
			<p class="text-sm text-on-surface-variant mb-3">Add an extra layer of security.</p>
			<button onclick={startSetup} disabled={setupLoading} class="m3-btn m3-btn-filled">
				{setupLoading ? 'Setting up...' : 'Enable 2FA'}
			</button>
		{/if}
	</div>

	<!-- Backups -->
	<div class="m3-card mb-4">
		<div class="flex items-center gap-3 mb-2">
			<span class="material-symbols-outlined text-primary">backup</span>
			<h3 class="m3-title-small text-on-surface">Backups</h3>
		</div>
		<p class="text-sm text-on-surface-variant mb-3">Auto-backups: daily 3:00 AM, weekly Sundays 4:00 AM. 7 daily + 4 weekly kept.</p>
		<button onclick={async () => { backupLoading = true; await fetch('/api/backup', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{"type":"daily"}' }); await loadBackups(); backupLoading = false; }}
			disabled={backupLoading} class="m3-btn m3-btn-tonal !h-9 text-xs mb-3">
			<span class="material-symbols-outlined text-base">add</span>
			{backupLoading ? 'Creating...' : 'Create backup now'}
		</button>
		{#if backups.length > 0}
			<div class="space-y-1.5 max-h-40 overflow-y-auto">
				{#each backups as b (b.name)}
					<div class="flex items-center justify-between text-xs py-1.5 px-3 bg-surface-container rounded-lg">
						<span class="text-on-surface truncate">{b.name}</span>
						<span class="text-on-surface-variant ml-2 flex-shrink-0">{fmtSize(b.size)}</span>
					</div>
				{/each}
			</div>
		{:else}<p class="text-xs text-on-surface-variant">No backups yet.</p>{/if}
	</div>

	<!-- WebDAV -->
	<div class="m3-card">
		<div class="flex items-center gap-3 mb-2">
			<span class="material-symbols-outlined text-primary">dns</span>
			<h3 class="m3-title-small text-on-surface">WebDAV Access</h3>
		</div>
		<p class="text-sm text-on-surface-variant mb-2">Mount as a network drive in Finder, Explorer, or Nautilus.</p>
		<div class="bg-surface-container rounded-xl p-3 font-mono text-xs text-on-surface select-all">
			{typeof window !== 'undefined' ? window.location.origin : ''}/dav/
		</div>
		<p class="text-xs text-on-surface-variant mt-2">Use your LiteCloud email and password.</p>
	</div>
</div>
