<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { formatFileSize } from '$lib/utils/filesize';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { t, getLocale } from '$lib/i18n/index.svelte';
	import { formatTimeAgo } from '$lib/utils/timeago';
	import AnimatedIcon from '$lib/components/AnimatedIcon.svelte';
	import { MORPH_PAIRS } from '$lib/utils/icon-paths';
	import { useSidebar } from '$lib/stores/sidebar.svelte';
	import { browser } from '$app/environment';
	import type { LayoutData } from './$types';
	let { data, children }: { data: LayoutData; children: any } = $props();

	const sidebar = useSidebar();

	// Notifications
	type NotifItem = { id: string; type: string; title: string; body: string | null; icon: string; actionUrl: string | null; read: boolean; createdAt: string };
	let unreadCount = $state(data.unreadNotifications ?? 0);
	let showNotifications = $state(false);
	let notifList: NotifItem[] = $state([]);
	let notifLoaded = $state(false);

	async function fetchUnreadCount() {
		const res = await fetch('/api/notifications?count=true');
		if (res.ok) unreadCount = (await res.json()).count;
	}
	async function loadNotifications() {
		const res = await fetch('/api/notifications');
		if (res.ok) { const d = await res.json(); notifList = d.notifications; unreadCount = d.unreadCount; notifLoaded = true; }
	}
	function toggleNotifications() {
		showNotifications = !showNotifications;
		if (showNotifications && !notifLoaded) loadNotifications();
	}
	async function markAllRead() {
		await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ markAll: true }) });
		notifList = notifList.map(n => ({ ...n, read: true }));
		unreadCount = 0;
	}
	async function handleNotifClick(notif: NotifItem) {
		if (!notif.read) {
			await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: notif.id }) });
			notifList = notifList.map(n => n.id === notif.id ? { ...n, read: true } : n);
			unreadCount = Math.max(0, unreadCount - 1);
		}
		showNotifications = false;
		if (notif.actionUrl) goto(notif.actionUrl);
	}

	$effect(() => {
		if (!browser) return;
		const timer = setInterval(fetchUnreadCount, 30_000);
		return () => clearInterval(timer);
	});

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
	const quotaColor = $derived(storagePct >= 90 ? 'error' : storagePct >= 75 ? 'tertiary' : 'primary');

	type NavItem = { href: string; labelKey: string; icon: string; match: (p: string) => boolean };
	const nav: NavItem[] = [
		{ href: '/files', labelKey: 'nav.files', icon: 'folder', match: (p) => p.startsWith('/files') },
		{ href: '/photos', labelKey: 'nav.photos', icon: 'image', match: (p) => p === '/photos' },
		{ href: '/shares', labelKey: 'nav.shared', icon: 'group', match: (p) => p === '/shares' },
		{ href: '/trash', labelKey: 'nav.trash', icon: 'delete', match: (p) => p === '/trash' },
		{ href: '/settings', labelKey: 'nav.settings', icon: 'settings', match: (p) => p.startsWith('/settings') },
	];

	let scrolled = $state(false);
	function onContentScroll(e: Event) { scrolled = (e.target as HTMLElement).scrollTop > 8; }

	function triggerUpload() {
		if (!$page.url.pathname.startsWith('/files')) {
			goto('/files').then(() => setTimeout(() => document.dispatchEvent(new CustomEvent('lc-upload')), 300));
		} else {
			document.dispatchEvent(new CustomEvent('lc-upload'));
		}
	}
</script>

<!-- Keyboard shortcut: Ctrl/Cmd+B -->
<svelte:window onkeydown={(e) => {
	if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); sidebar.toggle(); }
}} />

<div class="flex h-screen overflow-hidden bg-surface text-on-surface">

	<!-- ═══ Desktop Sidebar Wrapper (overflow visible for toggle button) ═══ -->
	<div class="hidden lg:block relative flex-shrink-0 {sidebar.collapsed ? 'w-16' : 'w-60'}"
		style="transition: width {sidebar.collapsed ? '200ms cubic-bezier(0.3, 0, 0.8, 0.15)' : '400ms cubic-bezier(0.05, 0.7, 0.1, 1)'};"
	>

		<!-- Toggle Button -->
		<button
			onclick={() => sidebar.toggle()}
			aria-expanded={!sidebar.collapsed}
			aria-label={sidebar.collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
			class="absolute top-5 right-0 translate-x-1/2 z-30 w-6 h-6 rounded-full bg-surface border border-outline-variant/30
				flex items-center justify-center hover:bg-surface-container-highest hover:border-outline-variant/50
				transition-all duration-200 shadow-sm cursor-pointer"
		>
			<span class="material-symbols-outlined text-[14px] text-on-surface-variant {sidebar.collapsed ? 'rotate-180' : ''}"
				style="transition: transform {sidebar.collapsed ? '200ms cubic-bezier(0.3,0,0.8,0.15)' : '400ms cubic-bezier(0.05,0.7,0.1,1)'};"
			>chevron_left</span>
		</button>

		<!-- Sidebar Content -->
		<aside class="h-full flex flex-col bg-surface-container-low overflow-hidden" role="navigation" aria-label="Main navigation">

			<!-- Brand -->
			<div class="flex items-center gap-3 h-14 flex-shrink-0 overflow-hidden {sidebar.collapsed ? 'px-0 justify-center' : 'px-5'}">
				<div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
					<span class="material-symbols-outlined text-primary text-[20px]">cloud</span>
				</div>
				<span class="m3-title-medium font-bold text-on-surface tracking-tight whitespace-nowrap overflow-hidden {sidebar.collapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}"
				style="transition: opacity {sidebar.collapsed ? '100ms cubic-bezier(0.3,0,1,1)' : '150ms cubic-bezier(0,0,0,1) 200ms'}, width 200ms;"
			>{t('app.name')}</span>
			</div>

			<!-- + New button -->
			<div class="{sidebar.collapsed ? 'px-2 flex justify-center' : 'px-3'} mb-2">
				{#if sidebar.collapsed}
					<Tooltip text={t('nav.new')} position="right">
						<button
							onclick={triggerUpload}
							class="flex items-center justify-center w-10 h-10 rounded-xl border-none bg-transparent text-primary
								hover:bg-surface-container-highest/60 active:scale-[0.95] cursor-pointer transition-colors duration-200"
						>
							<span class="material-symbols-outlined text-[22px]">add</span>
						</button>
					</Tooltip>
				{:else}
					<button
						onclick={triggerUpload}
						class="flex items-center gap-3 w-full h-12 px-4 rounded-2xl border-none bg-surface-container-lowest text-on-surface
							shadow-[0_1px_3px_0_rgb(0_0_0/0.08)] hover:shadow-[0_2px_6px_0_rgb(0_0_0/0.12)]
							active:scale-[0.98] cursor-pointer transition-all duration-200"
					>
						<span class="material-symbols-outlined text-[22px] text-primary flex-shrink-0">add</span>
						<span class="m3-label-large">{t('nav.new')}</span>
					</button>
				{/if}
			</div>

			<!-- Navigation -->
			<nav class="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden {sidebar.collapsed ? 'px-2' : 'px-3'} pt-1">
				{#each nav as item (item.href)}
					{@const active = item.match($page.url.pathname)}
					{#if sidebar.collapsed}
						<Tooltip text={t(item.labelKey)} position="right">
							<a href={item.href}
								class="flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-colors duration-200 mb-0.5
									{active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container-highest/60'}"
							>
								<span class="material-symbols-outlined text-[20px]" style={active ? "font-variation-settings: 'FILL' 1;" : ''}>{item.icon}</span>
							</a>
						</Tooltip>
					{:else}
						<a href={item.href}
							class="m3-nav-item {active ? 'active nav-active' : ''}"
						>
							<span class="material-symbols-outlined text-[20px]" style={active ? "font-variation-settings: 'FILL' 1;" : ''}>{item.icon}</span>
							<span class="whitespace-nowrap overflow-hidden text-sm">{t(item.labelKey)}</span>
						</a>
					{/if}
				{/each}
			</nav>

			<!-- Storage -->
			<a href="/storage" class="block flex-shrink-0 transition-colors duration-200 hover:bg-surface-container-high/50 no-underline group
				{sidebar.collapsed ? 'px-2 py-3' : 'mx-3 mb-3 px-3 py-2.5 rounded-xl'}">
				{#if sidebar.collapsed}
					<div class="flex justify-center mb-1.5">
						<span class="material-symbols-outlined text-[18px] transition-colors {quotaColor === 'error' ? 'text-error' : quotaColor === 'tertiary' ? 'text-tertiary' : 'text-on-surface-variant group-hover:text-primary'}">{storagePct >= 90 ? 'warning' : 'cloud'}</span>
					</div>
				{:else}
					<div class="flex items-center gap-2 mb-1.5">
						<span class="material-symbols-outlined text-[18px] transition-colors {quotaColor === 'error' ? 'text-error' : quotaColor === 'tertiary' ? 'text-tertiary' : 'text-on-surface-variant group-hover:text-primary'}">{storagePct >= 90 ? 'warning' : 'cloud'}</span>
						<span class="m3-label-medium transition-colors {quotaColor === 'error' ? 'text-error' : quotaColor === 'tertiary' ? 'text-tertiary' : 'text-on-surface-variant group-hover:text-on-surface'}">{storagePct >= 90 ? t('storage.almostFull') : t('storage.label')}</span>
					</div>
				{/if}
				<div class="h-1 rounded-full bg-surface-container-highest mb-1.5 {sidebar.collapsed ? 'w-8 mx-auto' : 'w-full'}">
					<div class="h-1 rounded-full transition-all duration-300 {quotaColor === 'error' ? 'bg-error' : quotaColor === 'tertiary' ? 'bg-tertiary' : 'bg-primary'}" style="width: {storagePct}%"></div>
				</div>
				{#if !sidebar.collapsed}
					<p class="m3-label-small text-on-surface-variant">{t('storage.used', { used: formatFileSize(data.storageUsed ?? 0), total: formatFileSize(data.storageQuota ?? 1073741824) })}</p>
				{/if}
			</a>
		</aside>
	</div>

	<!-- ═══ Mobile Header ═══ -->
	<div class="lg:hidden fixed top-0 inset-x-0 bg-surface-container-lowest z-40 px-4 h-14 flex items-center justify-between border-b border-outline-variant/20">
		<button onclick={() => mobileNav = !mobileNav} aria-label="Toggle menu" class="m3-icon-btn !-ml-2">
			<AnimatedIcon from={MORPH_PAIRS.menuToClose.from} to={MORPH_PAIRS.menuToClose.to} active={mobileNav} size={24} />
		</button>
		<span class="m3-title-medium font-bold text-on-surface">{t('app.name')}</span>
		<div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-semibold">
			{data.user.email[0].toUpperCase()}
		</div>
	</div>

	<!-- Mobile nav overlay -->
	{#if mobileNav}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="lg:hidden fixed inset-0 bg-scrim/32 z-50" style="animation: m3-fade-in var(--m3-duration-short3) var(--m3-ease-linear);" onclick={() => mobileNav = false}>
			<aside class="w-[280px] h-full bg-surface-container-low flex flex-col rounded-r-2xl shadow-[var(--m3-elevation-1)]" onclick={(e) => e.stopPropagation()}>
				<div class="flex items-center gap-3 px-6 pt-5 pb-4">
					<span class="material-symbols-outlined text-primary text-[24px]">cloud</span>
					<span class="m3-title-large font-bold text-on-surface">{t('app.name')}</span>
				</div>
				<nav class="flex-1 space-y-0.5 px-3">
					{#each nav as item (item.href)}
						{@const active = item.match($page.url.pathname)}
						<a href={item.href} onclick={() => mobileNav = false}
							class="m3-nav-item {active ? 'active' : ''}">
							<span class="material-symbols-outlined" style={active ? "font-variation-settings: 'FILL' 1;" : ''}>{item.icon}</span>
							<span>{t(item.labelKey)}</span>
						</a>
					{/each}
				</nav>
			</aside>
		</div>
	{/if}

	<!-- ═══ Main Content ═══ -->
	<main class="flex-1 flex flex-col h-full bg-surface-container-lowest lg:rounded-l-[2rem] mt-14 lg:mt-0 overflow-hidden">

		<!-- Top bar -->
		<header class="h-14 sticky top-0 z-30 flex items-center justify-between px-4 transition-all duration-200 flex-shrink-0
			{scrolled ? 'bg-surface-container shadow-[var(--m3-elevation-2)]' : 'bg-surface-container-lowest'}">
			<!-- Search -->
			<div class="flex-1 max-w-2xl relative">
				<div class="m3-search-bar">
					<span class="material-symbols-outlined text-on-surface-variant">search</span>
					<input
						type="search"
						aria-label="Search files"
						placeholder={t('search.placeholder')}
						value={searchQuery}
						oninput={onSearchInput}
						onfocus={() => { if (searchResults.length) searchOpen = true; }}
						onblur={() => setTimeout(() => searchOpen = false, 200)}
					/>
				</div>

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
						<p class="m3-body-medium text-on-surface-variant">{t('search.noResults', { query: searchQuery })}</p>
					</div>
				{/if}
			</div>

			<!-- Right actions -->
			<div class="flex items-center gap-1 ml-4">
				<!-- Notifications bell -->
				<div class="relative">
					<Tooltip text={t('notifications.title')}>
						<button onclick={toggleNotifications} class="m3-icon-btn" aria-label={t('notifications.title')}>
							<span class="material-symbols-outlined m3-icon-ring">notifications</span>
						</button>
					</Tooltip>
					{#if unreadCount > 0}
						<span class="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-error text-on-error text-[10px] font-medium flex items-center justify-center px-1 pointer-events-none z-10">
							{unreadCount > 99 ? '99+' : unreadCount}
						</span>
					{/if}

					{#if showNotifications}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="fixed inset-0 z-40" onclick={() => showNotifications = false}></div>
						<div class="absolute right-0 top-full mt-2 w-[380px] max-h-[480px] bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden z-50"
							style="box-shadow: var(--m3-elevation-3); animation: m3-menu-enter var(--m3-duration-short4) var(--m3-ease-emphasized-decel);">
							<div class="px-4 py-3 flex items-center justify-between border-b border-outline-variant/15">
								<span class="m3-title-small text-on-surface">{t('notifications.title')}</span>
								{#if unreadCount > 0}
									<button onclick={markAllRead} class="m3-btn m3-btn-text !h-7 !px-2 !min-w-0 text-xs">{t('notifications.markAllRead')}</button>
								{/if}
							</div>
							<div class="overflow-y-auto max-h-[400px]">
								{#if notifList.length === 0}
									<div class="py-10 text-center">
										<span class="material-symbols-outlined text-3xl text-outline-variant mb-2">notifications_none</span>
										<p class="m3-body-small text-on-surface-variant">{t('notifications.empty')}</p>
									</div>
								{:else}
									{#each notifList as notif (notif.id)}
										<button
											onclick={() => handleNotifClick(notif)}
											class="w-full px-4 py-3 flex items-start gap-3 hover:bg-surface-container-high/50 transition-colors text-left cursor-pointer {!notif.read ? 'bg-primary/[0.03]' : ''}"
										>
											<div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 {!notif.read ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant'}">
												<span class="material-symbols-outlined text-[18px]">{notif.icon}</span>
											</div>
											<div class="flex-1 min-w-0">
												<p class="m3-body-small truncate {!notif.read ? 'font-medium text-on-surface' : 'text-on-surface-variant'}">{notif.title}</p>
												{#if notif.body}<p class="m3-label-small text-on-surface-variant mt-0.5 line-clamp-2">{notif.body}</p>{/if}
												<p class="m3-label-small text-outline mt-1">{formatTimeAgo(notif.createdAt)}</p>
											</div>
											{#if !notif.read}<div class="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2"></div>{/if}
										</button>
									{/each}
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<Tooltip text={t('auth.signOut')}>
					<button
						onclick={async () => {
							await fetch('/api/auth/logout', { method: 'POST' });
							try { sessionStorage.removeItem('lc-mk'); } catch {}
							window.location.href = '/login';
						}}
						class="m3-icon-btn"
						aria-label={t('auth.signOut')}
					>
						<span class="material-symbols-outlined">logout</span>
					</button>
				</Tooltip>
				<Tooltip text={data.user.email}>
					<div class="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-sm font-medium ml-1 cursor-pointer hidden lg:flex">
						{data.user.email[0].toUpperCase()}
					</div>
				</Tooltip>
			</div>
		</header>

		<!-- Page content -->
		<div class="flex-1 overflow-y-auto" onscroll={onContentScroll}>
			{@render children()}
		</div>
	</main>
</div>
