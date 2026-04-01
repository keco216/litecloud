<script lang="ts">
	import { unlockMasterKey, storeMasterKey, generateEncryptionKeys } from '$lib/crypto';
	import { t } from '$lib/i18n/index.svelte';
	import AnimatedIcon from '$lib/components/AnimatedIcon.svelte';
	import { MORPH_PAIRS } from '$lib/utils/icon-paths';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();

	let unlocking = $state(false);
	let showPassword = $state(false);
	let lastPassword = $state(''); // retained client-side only, never sent back by server
	let countdown = $state(0);
	let countdownTimer: ReturnType<typeof setInterval> | null = null;

	$effect(() => {
		if (form && (form as any).rateLimited && (form as any).retryAfterMs) {
			countdown = Math.ceil((form as any).retryAfterMs / 1000);
			if (countdownTimer) clearInterval(countdownTimer);
			countdownTimer = setInterval(() => {
				countdown--;
				if (countdown <= 0) { clearInterval(countdownTimer!); countdownTimer = null; countdown = 0; }
			}, 1000);
		}
	});

	$effect(() => {
		if (form && !form.error && !unlocking) {
			const f = form as any;
			if (f.needsTotp) {
				// TOTP required — store password client-side for post-TOTP unlock
				sessionStorage.setItem('lc-pending-email', f.email);
				sessionStorage.setItem('lc-pending-pw', lastPassword);
				window.location.href = '/login/totp';
				return;
			}
			if (f.unlockEncryption) {
				unlocking = true;
				doUnlock(lastPassword, f.encryptionSalt, f.encryptedMasterKey, f.masterKeyIv);
			}
		}
	});

	async function doUnlock(password: string, salt: string, emk: string, mkiv: string) {
		if (salt && emk && mkiv) {
			// Unlock existing encryption keys
			try { const k = await unlockMasterKey(password, salt, emk, mkiv); storeMasterKey(k); } catch {}
		} else {
			// No encryption keys yet — generate them now (same as registration)
			try {
				const keys = await generateEncryptionKeys(password);
				await fetch('/api/auth/encryption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ encryptionSalt: keys.salt, encryptedMasterKey: keys.encryptedMasterKey, masterKeyIv: keys.masterKeyIv }) });
				const mk = await unlockMasterKey(password, keys.salt, keys.encryptedMasterKey, keys.masterKeyIv);
				storeMasterKey(mk);
			} catch {}
		}
		window.location.href = '/files';
	}
</script>

<svelte:head><title>{t('auth.signIn')} — {t('app.name')}</title></svelte:head>

<div class="bg-surface-container-low min-h-screen flex flex-col">
	<!-- Top bar -->
	<header class="fixed top-0 w-full bg-surface-container-low flex justify-between items-center px-6 py-4 z-50">
		<div class="flex items-center gap-2 m3-title-medium font-bold text-on-surface tracking-tight">
			<span class="material-symbols-outlined text-primary">cloud</span>
			<span>LiteCloud</span>
		</div>
	</header>

	<!-- Main -->
	<main class="flex-grow flex items-center justify-center px-4 pt-20 pb-32">
		<div class="w-full max-w-[420px] bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-10">
			<!-- Header -->
			<div class="flex flex-col items-center mb-8">
				<div class="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
					<span class="material-symbols-outlined text-[32px] text-primary">cloud</span>
				</div>
				<h1 class="m3-headline-small text-on-surface">{t('auth.signIn')}</h1>
				<p class="m3-body-medium text-on-surface-variant mt-1">{t('auth.continueTo')}</p>
			</div>

			{#if unlocking}
				<div class="py-12 text-center">
					<div class="m3-progress-circular m3-progress-circular-sm mx-auto mb-3"></div>
					<p class="m3-body-medium text-on-surface-variant">{t('auth.unlocking')}</p>
				</div>
			{:else}
				<form method="POST" class="space-y-5">
					{#if countdown > 0}
						<div role="alert" class="m3-body-small text-error bg-error-container/30 rounded-xl px-4 py-3 flex items-center gap-2">
							<span class="material-symbols-outlined text-[18px]">timer</span>
							{t('auth.rateLimited', { seconds: String(countdown) })}
						</div>
					{:else if form?.error}
						<div role="alert" class="m3-body-small text-error bg-error-container/30 rounded-xl px-4 py-3 flex items-center gap-2">
							<span class="material-symbols-outlined text-[18px]">error</span>
							{form.error}
						</div>
					{/if}

					<div>
						<label for="email" class="m3-label">{t('auth.email')}</label>
						<input
							type="email" id="email" name="email" value={form?.email ?? ''} required autocomplete="email"
							placeholder={t('auth.emailPlaceholder')}
							class="m3-input !rounded-lg"
						/>
					</div>

					<div>
						<label for="password" class="m3-label">{t('auth.password')}</label>
						<div class="relative">
							<input
								type={showPassword ? 'text' : 'password'} id="password" name="password" required autocomplete="current-password"
								oninput={(e: Event) => { lastPassword = (e.target as HTMLInputElement).value; }}
								placeholder={t('auth.passwordPlaceholder')}
								class="m3-input !rounded-lg !pr-12"
							/>
							<button type="button" onclick={() => showPassword = !showPassword} tabindex={-1}
								class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer p-1 rounded-full">
								<AnimatedIcon from={MORPH_PAIRS.visibilityToggle.from} to={MORPH_PAIRS.visibilityToggle.to} active={showPassword} size={20} />
							</button>
						</div>
					</div>

					<button type="submit" disabled={countdown > 0}
						class="m3-btn m3-btn-filled w-full !h-11 !rounded-full mt-4">
						{t('auth.signIn')}
					</button>
				</form>

				<div class="mt-8 pt-6 border-t border-outline-variant/20 text-center m3-body-medium">
					<span class="text-on-surface-variant">{t('auth.noAccount')}</span>
					<a class="text-primary font-medium hover:underline ml-1" href="/register">{t('auth.createAccount')}</a>
				</div>
			{/if}
		</div>
	</main>

	<footer class="fixed bottom-0 w-full flex justify-center gap-6 pb-6 m3-label-small text-on-surface-variant/50">
		<span>LiteCloud</span>
	</footer>
</div>
