<script lang="ts">
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { generateEncryptionKeys, unlockMasterKey, storeMasterKey } from '$lib/crypto';
	import { t } from '$lib/i18n/index.svelte';
	import type { PageData } from '../../../routes/(app)/settings/$types';

	let { data }: { data: PageData } = $props();
	let confirmDisable2FA = $state(false);

	let totpEnabled = $state(false);
	$effect(() => { totpEnabled = data.totpEnabled; });

	// E2E Encryption setup
	let hasEncryption = $state(false);
	$effect(() => { hasEncryption = data.hasEncryption; });
	let showEncryptionSetup = $state(false);
	let encryptionPassword = $state('');
	let encryptionLoading = $state(false);
	let encryptionError = $state('');

	async function setupEncryption() {
		if (!encryptionPassword) return;
		encryptionLoading = true;
		encryptionError = '';
		try {
			const keys = await generateEncryptionKeys(encryptionPassword);
			const r = await fetch('/api/auth/encryption', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ encryptionSalt: keys.salt, encryptedMasterKey: keys.encryptedMasterKey, masterKeyIv: keys.masterKeyIv })
			});
			if (!r.ok) throw new Error('Server error');
			const mk = await unlockMasterKey(encryptionPassword, keys.salt, keys.encryptedMasterKey, keys.masterKeyIv);
			storeMasterKey(mk);
			hasEncryption = true;
			showEncryptionSetup = false;
			encryptionPassword = '';
		} catch (err: any) {
			encryptionError = t('settings.encryptionSetupError');
		} finally {
			encryptionLoading = false;
		}
	}

	// Antivirus
	let avStatus = $state({ available: false, version: '' });
	let avStats = $state({ scanned: 0, clean: 0, infected: 0, pending: 0, skipped: 0, errors: 0 });
	let rescanning = $state(false);

	async function loadAvStatus() {
		const r = await fetch('/api/antivirus');
		if (r.ok) { const d = await r.json(); avStatus = d.status; avStats = d.stats; }
	}
	async function rescanPending() {
		rescanning = true;
		await fetch('/api/antivirus', { method: 'POST' });
		await loadAvStatus();
		rescanning = false;
	}
	$effect(() => { loadAvStatus(); });
	let qrCode = $state(''); let secretKey = $state(''); let verifyCode = $state('');
	let setupLoading = $state(false); let verifyError = $state(''); let showSetup = $state(false);

	async function startSetup() { setupLoading = true; const r = await fetch('/api/auth/totp/setup', { method: 'POST' }); if (r.ok) { const d = await r.json(); qrCode = d.qr; secretKey = d.secret; showSetup = true; } setupLoading = false; }
	async function confirmSetup() { verifyError = ''; const r = await fetch('/api/auth/totp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: verifyCode, mode: 'setup' }) }); if (r.ok) { totpEnabled = true; showSetup = false; qrCode = ''; secretKey = ''; verifyCode = ''; } else { verifyError = t('totp.invalidCode'); verifyCode = ''; } }
	async function disable2FA() { const r = await fetch('/api/auth/totp/disable', { method: 'POST' }); if (r.ok) { totpEnabled = false; confirmDisable2FA = false; } }
</script>

<div class="mb-6">
	<h2 class="m3-headline-small text-on-surface mb-1">{t('settings.security')}</h2>
	<p class="m3-body-small text-on-surface-variant">{t('settings.securityDesc')}</p>
</div>

<!-- Status overview -->
<div class="grid grid-cols-2 gap-3 mb-8">
	<div class="bg-surface-container rounded-xl p-4">
		<p class="m3-label-small text-on-surface-variant">{t('settings.encryption')}</p>
		<p class="m3-title-small mt-1 {hasEncryption ? 'text-primary' : 'text-on-surface-variant'}">{hasEncryption ? t('settings.active') : t('settings.inactive')}</p>
	</div>
	<div class="bg-surface-container rounded-xl p-4">
		<p class="m3-label-small text-on-surface-variant">2FA</p>
		<p class="m3-title-small mt-1 {totpEnabled ? 'text-primary' : 'text-on-surface-variant'}">{totpEnabled ? t('settings.active') : t('settings.inactive')}</p>
	</div>
</div>

<!-- E2E Encryption -->
<section class="mb-8">
	<h3 class="m3-label-large text-on-surface-variant uppercase tracking-wider mb-3 text-xs">{t('settings.encryption')}</h3>
	{#if hasEncryption}
		<p class="text-sm text-on-surface-variant">{t('settings.encryptionActive')}</p>
		<div class="mt-3 m3-chip !border-primary/30 !text-primary">
			<span class="material-symbols-outlined !text-[14px]">check_circle</span> {t('settings.active')}
		</div>
	{:else if showEncryptionSetup}
		<div class="space-y-4 max-w-sm">
			<p class="text-sm text-on-surface-variant">{t('settings.encryptionSetupDesc')}</p>
			<div>
				<label for="enc-pw" class="m3-label">{t('auth.password')}</label>
				<input type="password" id="enc-pw" bind:value={encryptionPassword}
					placeholder={t('auth.passwordPlaceholder')}
					class="m3-input"
					onkeydown={(e) => { if (e.key === 'Enter') setupEncryption(); }} />
			</div>
			{#if encryptionError}<div class="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3">{encryptionError}</div>{/if}
			<div class="flex gap-2">
				<button onclick={setupEncryption} disabled={!encryptionPassword || encryptionLoading} class="m3-btn m3-btn-filled flex-1">
					{encryptionLoading ? t('settings.settingUp') : t('settings.enableEncryption')}
				</button>
				<button onclick={() => { showEncryptionSetup = false; encryptionPassword = ''; encryptionError = ''; }} class="m3-btn m3-btn-text">{t('settings.cancel')}</button>
			</div>
		</div>
	{:else}
		<p class="text-sm text-on-surface-variant mb-3">{t('settings.encryptionInactive')}</p>
		<button onclick={() => showEncryptionSetup = true} class="m3-btn m3-btn-filled">
			{t('settings.enableEncryption')}
		</button>
	{/if}
</section>

<hr class="border-outline-variant/15 my-6" />

<!-- 2FA -->
<section>
	<h3 class="m3-label-large text-on-surface-variant uppercase tracking-wider mb-3 text-xs">{t('settings.twoFactor')}</h3>
	{#if totpEnabled && !showSetup}
		<p class="text-sm text-on-surface-variant mb-3">{t('settings.2faActive')}</p>
		<div class="flex items-center gap-3">
			<span class="m3-chip !border-primary/30 !text-primary"><span class="material-symbols-outlined !text-[14px]">check_circle</span> {t('settings.enabled')}</span>
			<button onclick={() => confirmDisable2FA = true} class="m3-btn m3-btn-text !text-error !h-8 text-xs">{t('settings.disable')}</button>
		</div>
	{:else if showSetup}
		<div class="space-y-4 max-w-sm">
			<p class="text-sm text-on-surface-variant">{t('settings.scanQR')}</p>
			<div class="flex justify-center">
				<img src={qrCode} alt="TOTP QR" class="w-48 h-48 rounded-xl" />
			</div>
			<details class="text-xs text-on-surface-variant">
				<summary class="cursor-pointer hover:text-on-surface">{t('settings.cantScan')}</summary>
				<code class="block mt-2 p-3 bg-surface-container rounded-xl font-mono text-[11px] break-all select-all">{secretKey}</code>
			</details>
			<div>
				<label class="m3-label">{t('settings.verificationCode')}</label>
				<input type="text" bind:value={verifyCode} maxlength="6" inputmode="numeric" placeholder="000000"
					class="m3-input text-center text-lg font-mono tracking-widest"
					oninput={(e) => { verifyCode = (e.target as HTMLInputElement).value.replace(/\D/g, ''); }}
					onkeydown={(e) => { if (e.key === 'Enter') confirmSetup(); }} />
			</div>
			{#if verifyError}<div class="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3">{verifyError}</div>{/if}
			<div class="flex gap-2">
				<button onclick={confirmSetup} disabled={verifyCode.length !== 6} class="m3-btn m3-btn-filled flex-1">{t('settings.verifyEnable')}</button>
				<button onclick={() => showSetup = false} class="m3-btn m3-btn-text">{t('settings.cancel')}</button>
			</div>
		</div>
	{:else}
		<p class="text-sm text-on-surface-variant mb-3">{t('settings.2faInactive')}</p>
		<button onclick={startSetup} disabled={setupLoading} class="m3-btn m3-btn-filled">
			{setupLoading ? t('settings.settingUp') : t('settings.enable2FA')}
		</button>
	{/if}
</section>

<hr class="border-outline-variant/15 my-6" />

<!-- Antivirus -->
<section>
	<h3 class="m3-label-large text-on-surface-variant uppercase tracking-wider mb-3 text-xs">{t('antivirus.title')}</h3>
	<div class="flex items-center gap-3 mb-4">
		<div class="w-10 h-10 rounded-full flex items-center justify-center {avStatus.available ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant'}">
			<span class="material-symbols-outlined">{avStatus.available ? 'verified_user' : 'gpp_maybe'}</span>
		</div>
		<div>
			<p class="m3-body-medium {avStatus.available ? 'text-on-surface' : 'text-on-surface-variant'}">{avStatus.available ? t('antivirus.active') : t('antivirus.inactive')}</p>
			{#if avStatus.version}<p class="m3-label-small text-on-surface-variant">{avStatus.version}</p>{/if}
		</div>
	</div>
	<div class="grid grid-cols-3 gap-3 mb-4">
		<div class="bg-surface-container rounded-xl p-3">
			<p class="m3-label-small text-on-surface-variant">{t('antivirus.scanned')}</p>
			<p class="m3-title-medium text-on-surface">{avStats.scanned}</p>
		</div>
		<div class="bg-surface-container rounded-xl p-3">
			<p class="m3-label-small text-on-surface-variant">{t('antivirus.clean')}</p>
			<p class="m3-title-medium text-primary">{avStats.clean}</p>
		</div>
		<div class="bg-surface-container rounded-xl p-3">
			<p class="m3-label-small text-on-surface-variant">{t('antivirus.infected')}</p>
			<p class="m3-title-medium text-error">{avStats.infected}</p>
		</div>
	</div>
	{#if avStats.pending > 0 || avStats.skipped > 0}
		<button onclick={rescanPending} disabled={rescanning} class="m3-btn m3-btn-outlined">
			<span class="material-symbols-outlined text-[18px]">refresh</span>
			{rescanning ? t('antivirus.scanning') : t('antivirus.rescan')} ({avStats.pending + avStats.skipped})
		</button>
	{/if}
</section>

<ConfirmDialog
	open={confirmDisable2FA}
	title={t('settings.disable2FATitle')}
	message={t('settings.disable2FAMsg')}
	confirmLabel={t('settings.disable')}
	danger={true}
	onconfirm={disable2FA}
	oncancel={() => confirmDisable2FA = false}
/>
