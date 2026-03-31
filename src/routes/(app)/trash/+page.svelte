<script lang="ts">
	import { formatFileSize } from '$lib/utils/filesize';
	import { invalidateAll } from '$app/navigation';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { t } from '$lib/i18n/index.svelte';

	type TrashItem = { id: string; name: string; path: string; mimeType: string | null; size: number; isFolder: boolean; deletedAt: string; daysLeft: number };
	let items: TrashItem[] = $state([]);
	let loading = $state(true);
	let confirmEmpty = $state(false);
	let confirmPurge = $state({ open: false, id: '', name: '' });

	async function loadTrash() {
		loading = true;
		const res = await fetch('/api/files/trash');
		if (res.ok) items = (await res.json()).items;
		loading = false;
	}

	async function restore(ids: string[]) {
		const res = await fetch('/api/files/trash', {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'restore', ids })
		});
		if (res.ok) {
			items = items.filter(i => !ids.includes(i.id));
			(window as any).__lc_toast?.(t('trash.restored', { count: String(ids.length) }), 'success');
		}
	}

	async function purge(ids: string[]) {
		const res = await fetch('/api/files/trash', {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'purge', ids })
		});
		if (res.ok) {
			items = items.filter(i => !ids.includes(i.id));
			confirmPurge = { open: false, id: '', name: '' };
			(window as any).__lc_toast?.(t('trash.purged', { count: String(ids.length) }), 'info');
		}
	}

	async function emptyTrash() {
		const res = await fetch('/api/files/trash', {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'empty' })
		});
		if (res.ok) {
			const count = items.length;
			items = [];
			confirmEmpty = false;
			(window as any).__lc_toast?.(t('trash.purged', { count: String(count) }), 'info');
		}
	}

	function fileIcon(mime: string | null, isFolder: boolean): { icon: string; color: string } {
		if (isFolder) return { icon: 'folder', color: '#5f6368' };
		if (!mime) return { icon: 'description', color: '#9ca3af' };
		if (mime.startsWith('image/')) return { icon: 'image', color: '#14b8a6' };
		if (mime.startsWith('video/')) return { icon: 'movie', color: '#ec4899' };
		if (mime.startsWith('audio/')) return { icon: 'music_note', color: '#f97316' };
		if (mime.includes('pdf')) return { icon: 'picture_as_pdf', color: '#ea4335' };
		if (mime.includes('zip') || mime.includes('tar')) return { icon: 'folder_zip', color: '#f59e0b' };
		if (mime.startsWith('text/') || mime.includes('json')) return { icon: 'code', color: '#10b981' };
		return { icon: 'description', color: '#9ca3af' };
	}

	function formatDate(d: string) {
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
	}

	$effect(() => { loadTrash(); });
</script>

<svelte:head><title>{t('trash.title')} — {t('app.name')}</title></svelte:head>

<div class="px-8 py-2">
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-3">
			<h2 class="m3-headline-small text-on-surface">{t('trash.title')}</h2>
			{#if items.length > 0}
				<span class="m3-chip !h-6 !text-xs">{items.length}</span>
			{/if}
		</div>
		{#if items.length > 0}
			<div class="flex items-center gap-2">
				<button onclick={() => restore(items.map(i => i.id))} class="m3-btn m3-btn-tonal !h-9 text-xs">
					<span class="material-symbols-outlined text-base">restore</span>
					{t('trash.restoreAll')}
				</button>
				<button onclick={() => confirmEmpty = true} class="m3-btn m3-btn-tonal !h-9 text-xs !text-error">
					<span class="material-symbols-outlined text-base">delete_forever</span>
					{t('trash.emptyTrash')}
				</button>
			</div>
		{/if}
	</div>

	<!-- Info banner -->
	{#if items.length > 0}
		<div class="m3-card !bg-surface-container-low flex items-center gap-3 mb-4 !py-3">
			<span class="material-symbols-outlined text-on-surface-variant text-[20px]">schedule</span>
			<p class="m3-body-small text-on-surface-variant">{t('trash.autoDelete')}</p>
		</div>
	{/if}

	{#if loading}
		<div class="text-center py-20">
			<div class="m3-progress-circular m3-progress-circular-sm mx-auto"></div>
		</div>
	{:else if items.length === 0}
		<div class="text-center py-20">
			<span class="material-symbols-outlined text-5xl text-outline-variant mb-4">delete_forever</span>
			<p class="text-lg font-medium text-on-surface">{t('trash.empty')}</p>
			<p class="text-sm text-on-surface-variant mt-1">{t('trash.emptySubtitle')}</p>
		</div>
	{:else}
		<div class="space-y-1">
			{#each items as item (item.id)}
				{@const icon = fileIcon(item.mimeType, item.isFolder ?? false)}
				<div class="m3-card flex items-center gap-4 group !py-3">
					<div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background: {icon.color}10;">
						<span class="material-symbols-outlined text-[20px]" style="color: {icon.color}; {item.isFolder ? "font-variation-settings: 'FILL' 1;" : ''}">{icon.icon}</span>
					</div>
					<div class="flex-1 min-w-0">
						<p class="m3-body-medium font-medium text-on-surface truncate">{item.name}</p>
						<div class="flex items-center gap-2 m3-label-small text-on-surface-variant">
							<span>{item.isFolder ? t('files.folder') : formatFileSize(item.size)}</span>
							<span>&middot;</span>
							<span>{formatDate(item.deletedAt)}</span>
							<span>&middot;</span>
							<span class="{item.daysLeft <= 3 ? 'text-error' : ''}">{t('trash.daysLeft', { days: String(item.daysLeft) })}</span>
						</div>
					</div>
					<div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
						<Tooltip text={t('trash.restore')}>
							<button onclick={() => restore([item.id])} class="m3-icon-btn !w-9 !h-9" aria-label={t('trash.restore')}>
								<span class="material-symbols-outlined text-lg">restore</span>
							</button>
						</Tooltip>
						<Tooltip text={t('trash.purge')}>
							<button onclick={() => confirmPurge = { open: true, id: item.id, name: item.name }} class="m3-icon-btn !w-9 !h-9 !text-error" aria-label={t('trash.purge')}>
								<span class="material-symbols-outlined text-lg m3-icon-shake">delete_forever</span>
							</button>
						</Tooltip>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<ConfirmDialog
	open={confirmEmpty}
	title={t('trash.emptyConfirmTitle')}
	message={t('trash.emptyConfirmMsg', { count: String(items.length) })}
	confirmLabel={t('trash.emptyTrash')}
	danger={true}
	onconfirm={emptyTrash}
	oncancel={() => confirmEmpty = false}
/>

<ConfirmDialog
	open={confirmPurge.open}
	title={t('trash.purgeConfirmTitle')}
	message={t('trash.purgeConfirmMsg')}
	confirmLabel={t('trash.purge')}
	danger={true}
	onconfirm={() => purge([confirmPurge.id])}
	oncancel={() => confirmPurge = { open: false, id: '', name: '' }}
/>
