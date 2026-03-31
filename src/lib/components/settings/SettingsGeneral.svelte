<script lang="ts">
	import { browser } from '$app/environment';
	import { t, getLocale, setLocale, locales, localeNames } from '$lib/i18n/index.svelte';

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

	$effect(() => { if (browser) applyTheme(themeMode); });
</script>

<div class="mb-6">
	<h2 class="m3-headline-small text-on-surface mb-1">{t('settings.general')}</h2>
	<p class="m3-body-small text-on-surface-variant">{t('settings.generalDesc')}</p>
</div>

<section class="mb-8">
	<h3 class="m3-label-large text-on-surface-variant uppercase tracking-wider mb-3 text-xs">{t('settings.language')}</h3>
	<div class="m3-segmented w-full max-w-sm">
		{#each locales as loc (loc)}
			<button
				onclick={() => setLocale(loc)}
				class="m3-segmented-btn flex-1 {getLocale() === loc ? 'active' : ''}"
			>
				{#if getLocale() === loc}
					<span class="material-symbols-outlined" style="font-size: 18px;">check</span>
				{/if}
				{localeNames[loc]}
			</button>
		{/each}
	</div>
</section>

<hr class="border-outline-variant/15 my-6" />

<section>
	<h3 class="m3-label-large text-on-surface-variant uppercase tracking-wider mb-3 text-xs">{t('settings.appearance')}</h3>
	<div class="m3-segmented w-full max-w-sm">
		{#each [
			{ mode: 'system' as ThemeMode, icon: 'brightness_auto', labelKey: 'settings.system' },
			{ mode: 'light' as ThemeMode, icon: 'light_mode', labelKey: 'settings.light' },
			{ mode: 'dark' as ThemeMode, icon: 'dark_mode', labelKey: 'settings.dark' }
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
				{t(opt.labelKey)}
			</button>
		{/each}
	</div>
</section>
