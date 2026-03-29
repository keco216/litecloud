<script lang="ts">
	import { generateEncryptionKeys, storeMasterKey, unlockMasterKey } from '$lib/crypto';
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
	let setting = $state(false);
	let lastPassword = $state(''); // retained client-side only

	$effect(() => {
		if (form && !form.error && (form as any).setupEncryption && !setting) {
			setting = true;
			setupEncryption(lastPassword).then(() => { window.location.href = '/files'; });
		}
	});

	async function setupEncryption(password: string) {
		const keys = await generateEncryptionKeys(password);
		await fetch('/api/auth/encryption', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(keys) });
		const mk = await unlockMasterKey(password, keys.salt, keys.encryptedMasterKey, keys.masterKeyIv);
		storeMasterKey(mk);
	}
</script>

<svelte:head><title>Register — LiteCloud</title></svelte:head>

<div class="bg-surface-container-low min-h-screen flex flex-col">
	<header class="fixed top-0 w-full bg-surface-container-low flex justify-between items-center px-6 py-4 z-50">
		<div class="flex items-center gap-2 m3-title-medium font-bold text-on-surface tracking-tight">
			<span class="material-symbols-outlined text-primary">cloud</span>
			<span>LiteCloud</span>
		</div>
	</header>

	<main class="flex-grow flex items-center justify-center px-4 pt-20 pb-32">
		<div class="w-full max-w-[420px] bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-10">
			<div class="flex flex-col items-center mb-8">
				<div class="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
					<span class="material-symbols-outlined text-[32px] text-primary">cloud</span>
				</div>
				<h1 class="m3-headline-small text-on-surface">Create account</h1>
				<p class="m3-body-medium text-on-surface-variant mt-1">to start using LiteCloud</p>
			</div>

			{#if setting}
				<div class="py-12 text-center">
					<div class="m3-progress-circular m3-progress-circular-sm mx-auto mb-3"></div>
					<p class="m3-body-medium text-on-surface-variant">Setting up encryption...</p>
					<p class="m3-body-small text-on-surface-variant/60 mt-1">Your files will be end-to-end encrypted</p>
				</div>
			{:else}
				<form method="POST" class="space-y-5">
					{#if form?.error}
						<div role="alert" class="m3-body-small text-error bg-error-container/30 rounded-xl px-4 py-3 flex items-center gap-2">
							<span class="material-symbols-outlined text-[18px]">error</span>
							{form.error}
						</div>
					{/if}
					<div>
						<label for="email" class="m3-label">Email</label>
						<input type="email" id="email" name="email" value={form?.email ?? ''} required autocomplete="email" placeholder="you@example.com"
							class="m3-input !rounded-lg" />
					</div>
					<div>
						<label for="password" class="m3-label">Password</label>
						<input type="password" id="password" name="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters"
						oninput={(e: Event) => { lastPassword = (e.target as HTMLInputElement).value; }}
							class="m3-input !rounded-lg" />
					</div>
					<div>
						<label for="confirm" class="m3-label">Confirm password</label>
						<input type="password" id="confirm" name="confirm" required minlength="8" autocomplete="new-password" placeholder="Repeat password"
							class="m3-input !rounded-lg" />
					</div>
					<button type="submit"
						class="m3-btn m3-btn-filled w-full !h-11 !rounded-full mt-4">
						Create account
					</button>
				</form>
				<div class="mt-8 pt-6 border-t border-outline-variant/20 text-center m3-body-medium">
					<span class="text-on-surface-variant">Already have an account?</span>
					<a class="text-primary font-medium hover:underline ml-1" href="/login">Sign in</a>
				</div>
			{/if}
		</div>
	</main>
</div>
