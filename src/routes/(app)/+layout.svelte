<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { formatFileSize } from '$lib/utils/filesize';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import type { LayoutData } from './$types';
	let { data, children }: { data: LayoutData; children: any } = $props();

	// Search
	let searchQuery = $state('');
	let searchResults: { fileId: string; name: string; snippet: string }[] = $state([]);
	let searchOpen = $state(false);
	let searchTimer: ReturnType<typeof setTimeout>;
	let mobileNav = $state(false);

	function onSearchInput(e: Event) {
		searchQuery = (e.target as HTMLInputElement).value;
		clearTimeout(searchTimer);
		if (!searchQuery.trim()) { searchResults = []; searchOpen = false; return; }
		searchTimer = setTimeout(async () => {
			const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
			if (res.ok) { const d = await res.json(); searchResults = d.results; searchOpen = true; }
		}, 250);
	}

	const storagePct = $derived(Math.min(100, Math.round(((data.storageUsed ?? 0) / (data.storageQuota ?? 1073741824)) * 100)));

	type NavItem = { href: string; label: string; icon: string; match: (p: string) => boolean };
	const nav: NavItem[] = [
		{ href: '/files', label: 'My Files', icon: 'folder', match: (p) => p.startsWith('/files') },
		{ href: '/photos', label: 'Photos', icon: 'image', match: (p) => p === '/photos' },
		{ href: '/shares', label: 'Shared', icon: 'group', match: (p) => p === '/shares' },
		{ href: '/settings', label: 'Settings', icon: 'settings', match: (p) => p === '/settings' },
	];

	function triggerUpload() {
		if (!$page.url.pathname.startsWith('/files')) {
			goto('/files').then(() => setTimeout(() => document.dispatchEvent(new CustomEvent('lc-upload')), 300));
		} else {
			document.dispatchEvent(new CustomEvent('lc-upload'));
		}
	}
</script>

<div class="flex h-screen overflow-hidden bg-surface text-on-surface">

	<!-- ═══ Sidebar ═══ -->
	<aside class="hidden md:flex flex-col w-64 h-full fixed left-0 top-0 bg-surface-container-low z-40">

		<!-- Brand -->
		<div class="flex items-center gap-3 px-6 pt-5 pb-4">
			<span class="material-symbols-outlined text-primary text-[28px]">cloud</span>
			<span class="m3-title-large font-bold text-on-surface tracking-tight">LiteCloud</span>
		</div>

		<!-- + New button (Google Drive style) -->
		<div class="px-3 mb-2">
			<button
				onclick={triggerUpload}
				class="flex items-center gap-3 h-14 w-full px-4 rounded-2xl border-none
					bg-surface-container-lowest text-on-surface
					shadow-[0_1px_3px_0_rgb(0_0_0/0.08)] hover:shadow-[0_2px_6px_0_rgb(0_0_0/0.12)]
					active:scale-[0.98] cursor-pointer transition-all duration-200"
			>
				<span class="material-symbols-outlined text-[24px] text-primary">add</span>
				<span class="m3-label-large">New</span>
			</button>
		</div>

		<!-- Navigation -->
		<nav class="flex-1 space-y-0.5 overflow-y-auto px-3 pt-2">
			{#each nav as item (item.href)}
				{@const active = item.match($page.url.pathname)}
				<a
					href={item.href}
					class="m3-nav-item {active ? 'active nav-active' : ''}"
				>
					<span class="material-symbols-outlined" style={active ? "font-variation-settings: 'FILL' 1;" : ''}>{item.icon}</span>
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- Storage -->
		<div class="mx-3 mb-3 px-3 py-2.5 rounded-xl hover:bg-surface-container-high/50 transition-colors duration-200 group">
			<div class="flex items-center gap-2 mb-1.5">
				<span class="material-symbols-outlined text-on-surface-variant text-[18px] group-hover:text-primary transition-colors">cloud</span>
				<span class="m3-label-medium text-on-surface-variant group-hover:text-on-surface transition-colors">Storage</span>
			</div>
			<div class="w-full h-1 rounded-full bg-surface-container-highest mb-1.5">
				<div class="h-1 rounded-full bg-primary transition-all duration-300" style="width: {storagePct}%"></div>
			</div>
			<p class="m3-label-small text-on-surface-variant">{formatFileSize(data.storageUsed ?? 0)} of {formatFileSize(data.storageQuota ?? 1073741824)} used</p>
		</div>
	</aside>

	<!-- ═══ Mobile header ═══ -->
	<div class="md:hidden fixed top-0 inset-x-0 bg-surface-container-lowest z-40 px-4 h-14 flex items-center justify-between border-b border-outline-variant/20">
		<button onclick={() => mobileNav = !mobileNav} aria-label="Toggle menu" class="m3-icon-btn !-ml-2">
			<span class="material-symbols-outlined">menu</span>
		</button>
		<span class="m3-title-medium font-bold text-on-surface">LiteCloud</span>
		<div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-semibold">
			{data.user.email[0].toUpperCase()}
		</div>
	</div>

	<!-- ═══ Mobile nav overlay (M3 Modal Navigation Drawer) ═══ -->
	{#if mobileNav}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="md:hidden fixed inset-0 bg-scrim/32 z-50" style="animation: m3-fade-in 200ms ease;" onclick={() => mobileNav = false}>
			<aside class="w-[280px] h-full bg-surface-container-low flex flex-col rounded-r-2xl shadow-[var(--m3-elevation-1)]" onclick={(e) => e.stopPropagation()}>
				<div class="flex items-center gap-3 px-6 pt-5 pb-4">
					<span class="material-symbols-outlined text-primary text-[24px]">cloud</span>
					<span class="m3-title-large font-bold text-on-surface">LiteCloud</span>
				</div>
				<nav class="flex-1 space-y-0.5 px-3">
					{#each nav as item (item.href)}
						{@const active = item.match($page.url.pathname)}
						<a href={item.href} onclick={() => mobileNav = false}
							class="m3-nav-item {active ? 'active' : ''}">
							<span class="material-symbols-outlined" style={active ? "font-variation-settings: 'FILL' 1;" : ''}>{item.icon}</span>
							<span>{item.label}</span>
						</a>
					{/each}
				</nav>
			</aside>
		</div>
	{/if}

	<!-- ═══ Main content ═══ -->
	<main class="md:ml-64 flex-1 flex flex-col h-full bg-surface-container-lowest md:rounded-l-[2rem] mt-14 md:mt-0">

		<!-- Top bar -->
		<header class="h-16 sticky top-0 z-30 flex items-center justify-between px-4 bg-surface-container-lowest">
			<!-- Search -->
			<div class="flex-1 max-w-2xl relative">
				<div class="m3-search-bar">
					<span class="material-symbols-outlined text-on-surface-variant">search</span>
					<input
						type="search"
						aria-label="Search files"
						placeholder="Search in LiteCloud"
						value={searchQuery}
						oninput={onSearchInput}
						onfocus={() => { if (searchResults.length) searchOpen = true; }}
						onblur={() => setTimeout(() => searchOpen = false, 200)}
					/>
				</div>

				<!-- Search results dropdown -->
				{#if searchOpen && searchResults.length > 0}
					<div class="absolute top-full mt-1 left-0 right-0 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden z-50 max-h-72 overflow-y-auto"
						style="box-shadow: var(--m3-elevation-2);">
						{#each searchResults as result (result.fileId)}
							<button
								onmousedown={() => { searchOpen = false; searchQuery = ''; goto('/files'); }}
								class="m3-list-item w-full text-left"
							>
								<span class="material-symbols-outlined text-on-surface-variant text-[20px]">description</span>
								<div class="min-w-0">
									<p class="m3-body-medium text-on-surface truncate">{result.name}</p>
									{#if result.snippet}<p class="m3-body-small text-on-surface-variant truncate">{@html result.snippet}</p>{/if}
								</div>
							</button>
						{/each}
					</div>
				{:else if searchOpen && searchQuery.trim()}
					<div class="absolute top-full mt-1 left-0 right-0 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-6 z-50 text-center"
						style="box-shadow: var(--m3-elevation-2);">
						<p class="m3-body-medium text-on-surface-variant">No results for "{searchQuery}"</p>
					</div>
				{/if}
			</div>

			<!-- Right actions -->
			<div class="flex items-center gap-1 ml-4">
				<Tooltip text="Sign out">
					<button
						onclick={async () => {
							await fetch('/api/auth/logout', { method: 'POST' });
							try { sessionStorage.removeItem('lc-mk'); } catch {}
							window.location.href = '/login';
						}}
						class="m3-icon-btn"
						aria-label="Sign out"
					>
						<span class="material-symbols-outlined">logout</span>
					</button>
				</Tooltip>
				<Tooltip text={data.user.email}>
					<div class="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-sm font-medium ml-1 cursor-pointer hidden md:flex">
						{data.user.email[0].toUpperCase()}
					</div>
				</Tooltip>
			</div>
		</header>

		<!-- Page content -->
		<div class="flex-1 overflow-y-auto">
			{@render children()}
		</div>
	</main>
</div>
