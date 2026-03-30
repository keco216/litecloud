<script lang="ts">
	import { unlockMasterKey, storeMasterKey } from '$lib/crypto';
	import { t } from '$lib/i18n/index.svelte';
	let code = $state(''); let errorMsg = $state(''); let verifying = $state(false);

	async function verify() {
		if (code.length !== 6) return;
		verifying = true; errorMsg = '';
		try {
			const res = await fetch('/api/auth/totp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, mode: 'login' }) });
			if (!res.ok) { errorMsg = t('totp.invalidCode'); verifying = false; code = ''; return; }
			const email = sessionStorage.getItem('lc-pending-email') || '';
			const pw = sessionStorage.getItem('lc-pending-pw') || '';
			sessionStorage.removeItem('lc-pending-email'); sessionStorage.removeItem('lc-pending-pw');
			if (pw) {
				try {
					const r = await fetch(`/api/auth/encryption?email=${encodeURIComponent(email)}`);
					if (r.ok) { const enc = await r.json(); if (enc.encryptionSalt) { const k = await unlockMasterKey(pw, enc.encryptionSalt, enc.encryptedMasterKey, enc.masterKeyIv); storeMasterKey(k); } }
				} catch {}
			}
			window.location.href = '/files';
		} catch { errorMsg = 'Network error'; verifying = false; }
	}
</script>

<svelte:head><title>{t('totp.title')} — {t('app.name')}</title></svelte:head>

<div class="min-h-screen bg-surface-container-low flex flex-col">
	<header class="fixed top-0 w-full bg-surface-container-low flex items-center px-6 py-4 z-50">
		<div class="flex items-center gap-2 text-xl font-bold text-on-surface tracking-tight">
			<span class="material-symbols-outlined text-primary">cloud</span><span>LiteCloud</span>
		</div>
	</header>

	<main class="flex-grow flex items-center justify-center px-4 pt-20 pb-32">
		<div class="w-full max-w-[420px] bg-surface-container-lowest rounded-3xl p-8" style="box-shadow: 0 1px 3px 1px rgb(0 0 0 / 15%), 0 1px 2px 0 rgb(0 0 0 / 30%);">
			<div class="flex flex-col items-center mb-8">
				<div class="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
					<span class="material-symbols-outlined text-4xl text-primary">security</span>
				</div>
				<h1 class="text-2xl font-bold tracking-tight text-on-surface">{t('totp.title')}</h1>
				<p class="text-sm text-on-surface-variant mt-1">{t('totp.subtitle')}</p>
			</div>

			{#if errorMsg}
				<div class="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3 mb-4">{errorMsg}</div>
			{/if}

			<input type="text" bind:value={code} maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="000000"
				class="m3-input text-center text-2xl font-mono tracking-[0.5em] !h-14 mb-4"
				oninput={(e) => { code = (e.target as HTMLInputElement).value.replace(/\D/g, ''); }}
				onkeydown={(e) => { if (e.key === 'Enter') verify(); }} />

			<button onclick={verify} disabled={code.length !== 6 || verifying} class="m3-btn m3-btn-filled w-full !h-12">
				<span class="material-symbols-outlined text-lg">check</span>
				{verifying ? t('totp.verifying') : t('totp.verify')}
			</button>

			<p class="text-center m3-body-medium text-on-surface-variant mt-6">
				<a href="/login" class="text-primary font-medium hover:underline">{t('totp.backToSignIn')}</a>
			</p>
		</div>
	</main>
</div>
