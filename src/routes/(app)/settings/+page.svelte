<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n/index.svelte';
	import SettingsGeneral from '$lib/components/settings/SettingsGeneral.svelte';
	import SettingsTags from '$lib/components/settings/SettingsTags.svelte';
	import SettingsSecurity from '$lib/components/settings/SettingsSecurity.svelte';
	import SettingsAdvanced from '$lib/components/settings/SettingsAdvanced.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const activeTab = $derived($page.url.searchParams.get('tab') || 'general');

	const tabs = [
		{ id: 'general', labelKey: 'settings.general', icon: 'settings' },
		{ id: 'tags', labelKey: 'tags.title', icon: 'label' },
		{ id: 'security', labelKey: 'settings.security', icon: 'shield' },
		{ id: 'advanced', labelKey: 'settings.advanced', icon: 'build' }
	];

	function switchTab(tabId: string) {
		const url = tabId === 'general' ? '/settings' : `/settings?tab=${tabId}`;
		goto(url, { replaceState: true, noScroll: true });
	}
</script>

<svelte:head><title>{t('settings.title')} — {t('app.name')}</title></svelte:head>

<div class="px-6 py-4">
	<h1 class="m3-headline-small text-on-surface mb-6">{t('settings.title')}</h1>

	<div class="flex flex-col lg:flex-row gap-6 lg:gap-10 max-w-4xl">

		<!-- Sidebar Navigation (Desktop) -->
		<nav class="hidden lg:flex flex-col gap-0.5 w-52 flex-shrink-0 sticky top-6 self-start">
			{#each tabs as tab (tab.id)}
				<button
					onclick={() => switchTab(tab.id)}
					class="flex items-center gap-3 px-4 py-2.5 rounded-full text-sm transition-colors duration-200 text-left cursor-pointer
						{activeTab === tab.id
							? 'bg-secondary-container text-on-secondary-container font-medium'
							: 'text-on-surface-variant hover:bg-surface-container-highest/60'}"
				>
					<span class="material-symbols-outlined text-[20px]" style={activeTab === tab.id ? "font-variation-settings: 'FILL' 1;" : ''}>{tab.icon}</span>
					{t(tab.labelKey)}
				</button>
			{/each}
		</nav>

		<!-- Horizontal Tabs (Mobile) -->
		<nav class="lg:hidden flex gap-1 overflow-x-auto -mx-2 px-2 pb-2" style="scrollbar-width: none;">
			{#each tabs as tab (tab.id)}
				<button
					onclick={() => switchTab(tab.id)}
					class="flex items-center gap-2 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors duration-200 flex-shrink-0 cursor-pointer
						{activeTab === tab.id
							? 'bg-secondary-container text-on-secondary-container font-medium'
							: 'text-on-surface-variant hover:bg-surface-container-highest/60'}"
				>
					<span class="material-symbols-outlined text-[18px]">{tab.icon}</span>
					{t(tab.labelKey)}
				</button>
			{/each}
		</nav>

		<!-- Content -->
		<div class="flex-1 min-w-0">
			{#key activeTab}
				<div class="animate-settings-fade">
					{#if activeTab === 'general'}
						<SettingsGeneral />
					{:else if activeTab === 'tags'}
						<SettingsTags />
					{:else if activeTab === 'security'}
						<SettingsSecurity {data} />
					{:else if activeTab === 'advanced'}
						<SettingsAdvanced />
					{/if}
				</div>
			{/key}
		</div>
	</div>
</div>
