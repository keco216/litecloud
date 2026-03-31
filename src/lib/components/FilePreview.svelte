<script lang="ts">
	import { formatFileSize } from '$lib/utils/filesize';
	import { loadMasterKey, decryptFile } from '$lib/crypto';
	import { invalidateAll } from '$app/navigation';
	import { t } from '$lib/i18n/index.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

	let { open = false, fileId = '', fileName = '', fileSize = 0, mimeType = '', encrypted = false, iv = null as string | null, onclose }:
		{ open: boolean; fileId: string; fileName: string; fileSize: number; mimeType: string; encrypted?: boolean; iv?: string | null; onclose: () => void } = $props();

	let textContent = $state('');
	let loading = $state(false);
	let blobUrl = $state('');
	let lastFileId = '';

	// Version history state
	type VersionItem = { id: string; fileId: string; versionNumber: number; size: number; createdAt: string };
	let showVersions = $state(false);
	let versions: VersionItem[] = $state([]);
	let versionsLoading = $state(false);
	let confirmRestore = $state({ open: false, versionId: '', versionNumber: 0 });

	const isImage = $derived(mimeType.startsWith('image/'));
	const isVideo = $derived(mimeType.startsWith('video/'));
	const isAudio = $derived(mimeType.startsWith('audio/'));
	const isPdf = $derived(mimeType === 'application/pdf');
	const isText = $derived(
		mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml') ||
		mimeType.includes('javascript') || mimeType.includes('yaml') || mimeType.includes('csv') ||
		mimeType.includes('markdown') || mimeType.includes('svg')
	);
	const hasNativePreview = $derived(isImage || isVideo || isAudio || isPdf || isText);
	const downloadUrl = $derived(`/api/files/download?id=${fileId}`);
	const inlineUrl = $derived(`/api/files/download?id=${fileId}&inline`);
	const fi = $derived(fileIcon(mimeType));

	function fileIcon(mime: string): { icon: string; color: string } {
		if (mime.startsWith('image/')) return { icon: 'image', color: '#14b8a6' };
		if (mime.startsWith('video/')) return { icon: 'movie', color: '#ec4899' };
		if (mime.startsWith('audio/')) return { icon: 'music_note', color: '#f97316' };
		if (mime.includes('pdf')) return { icon: 'picture_as_pdf', color: '#ea4335' };
		if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return { icon: 'table_chart', color: '#34a853' };
		if (mime.includes('document') || mime.includes('msword')) return { icon: 'description', color: '#4285f4' };
		if (mime.includes('presentation') || mime.includes('powerpoint')) return { icon: 'slideshow', color: '#fbbc04' };
		if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('7z')) return { icon: 'folder_zip', color: '#f59e0b' };
		if (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml')) return { icon: 'code', color: '#10b981' };
		return { icon: 'description', color: '#9ca3af' };
	}

	function fileExt(name: string): string {
		const parts = name.split('.');
		return parts.length > 1 ? parts.pop()!.toUpperCase() : '';
	}

	function formatDate(d: string) {
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
	}

	$effect(() => {
		if (!open || !fileId) return;
		if (fileId === lastFileId) return;
		lastFileId = fileId;
		showVersions = false;
		versions = [];
		loadPreview();
	});

	function loadPreview() {
		textContent = '';
		if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
		blobUrl = '';

		if (encrypted && iv && hasNativePreview) {
			loading = true;
			decryptForPreview().finally(() => { loading = false; });
		} else if (isText && fileSize < 500_000) {
			loading = true;
			fetch(downloadUrl)
				.then(r => r.text())
				.then(t => { textContent = t; })
				.catch(() => { textContent = 'Failed to load.'; })
				.finally(() => { loading = false; });
		} else if (isImage || isVideo || isAudio || isPdf) {
			blobUrl = inlineUrl;
		}
	}

	async function decryptForPreview() {
		try {
			const mk = await loadMasterKey();
			if (!mk || !iv) throw new Error();
			const res = await fetch(downloadUrl);
			const ct = await res.arrayBuffer();
			const pt = await decryptFile(ct, iv, mk);
			if (isText) textContent = new TextDecoder().decode(pt);
			else blobUrl = URL.createObjectURL(new Blob([pt], { type: mimeType }));
		} catch {
			textContent = 'Failed to decrypt.';
		}
	}

	async function loadVersions() {
		if (showVersions) { showVersions = false; return; }
		versionsLoading = true;
		const res = await fetch(`/api/files/versions?id=${fileId}`);
		if (res.ok) {
			const data = await res.json();
			versions = data.versions;
		}
		versionsLoading = false;
		showVersions = true;
	}

	async function doRestore() {
		const { versionId } = confirmRestore;
		confirmRestore = { open: false, versionId: '', versionNumber: 0 };
		const res = await fetch('/api/files/versions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ fileId, versionId })
		});
		if (res.ok) {
			(window as any).__lc_toast?.(t('versions.restore') + ' ✓', 'success');
			await invalidateAll();
			// Reload versions list
			showVersions = false;
			loadVersions();
			// Reload preview
			lastFileId = '';
			loadPreview();
		}
	}

	function close() {
		lastFileId = '';
		textContent = '';
		showVersions = false;
		versions = [];
		if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
		blobUrl = '';
		onclose();
	}
</script>

<svelte:window onkeydown={(e) => { if (open && e.key === 'Escape') close(); }} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
		style="animation: m3-fade-in var(--m3-duration-short3) var(--m3-ease-linear);"
		onclick={(e) => { if (e.target === e.currentTarget) close(); }}
	>
		<div class="bg-surface-container-lowest rounded-[1.75rem] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" style="animation: m3-dialog-enter var(--m3-duration-medium4) var(--m3-ease-emphasized-decel) both; box-shadow: var(--m3-elevation-3);">

			<!-- Header -->
			<div class="px-6 py-4 flex items-center justify-between flex-shrink-0 border-b border-outline-variant/10 relative z-20">
				<div class="flex items-center gap-3 min-w-0">
					<div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style="background: {fi.color}12;">
						<span class="material-symbols-outlined text-[20px]" style="color: {fi.color};">{fi.icon}</span>
					</div>
					<div class="min-w-0">
						<p class="m3-body-medium font-medium text-on-surface truncate">{fileName}</p>
						<p class="m3-label-small text-on-surface-variant">{formatFileSize(fileSize)}{fileExt(fileName) ? ` \u00B7 ${fileExt(fileName)}` : ''}</p>
					</div>
				</div>
				<div class="flex items-center gap-2 flex-shrink-0">
					<a href={downloadUrl} class="m3-icon-btn" aria-label={t('files.download')}>
						<span class="material-symbols-outlined">download</span>
					</a>
					<button
						type="button"
						onmousedown={(e) => { e.preventDefault(); e.stopPropagation(); close(); }}
						onclick={(e) => { e.preventDefault(); e.stopPropagation(); close(); }}
						class="w-10 h-10 rounded-full flex items-center justify-center cursor-pointer hover:bg-surface-container-highest transition-colors"
						aria-label={t('share.close')}
					>
						<span class="material-symbols-outlined">close</span>
					</button>
				</div>
			</div>

			<!-- Version history toggle -->
			{#if !encrypted}
				<div class="px-6 py-2 border-b border-outline-variant/10 flex-shrink-0">
					<button onclick={loadVersions} class="m3-btn m3-btn-text !h-8 !px-3 text-xs">
						<span class="material-symbols-outlined text-[16px]">history</span>
						{#if versionsLoading}
							...
						{:else if showVersions}
							{t('versions.title')}
						{:else}
							{t('versions.title')}{versions.length > 0 ? ` (${versions.length})` : ''}
						{/if}
					</button>
				</div>

				{#if showVersions}
					<div class="px-6 py-3 bg-surface-container-low max-h-48 overflow-y-auto border-b border-outline-variant/10 flex-shrink-0">
						{#if versions.length === 0}
							<p class="m3-body-small text-on-surface-variant py-2">{t('versions.noVersions')}</p>
						{:else}
							{#each versions as v (v.id)}
								<div class="flex items-center justify-between py-2 group">
									<div class="m3-body-small">
										<span class="font-medium text-on-surface">{t('versions.version', { n: String(v.versionNumber) })}</span>
										<span class="text-on-surface-variant ml-2">{formatDate(v.createdAt)}</span>
										<span class="text-on-surface-variant ml-2">{formatFileSize(v.size)}</span>
									</div>
									<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
										<Tooltip text={t('files.download')}>
											<a href="/api/files/versions/download?fileId={fileId}&versionId={v.id}" class="m3-icon-btn !w-7 !h-7">
												<span class="material-symbols-outlined text-[16px]">download</span>
											</a>
										</Tooltip>
										<Tooltip text={t('versions.restore')}>
											<button onclick={() => confirmRestore = { open: true, versionId: v.id, versionNumber: v.versionNumber }} class="m3-icon-btn !w-7 !h-7">
												<span class="material-symbols-outlined text-[16px]">restore</span>
											</button>
										</Tooltip>
									</div>
								</div>
							{/each}
						{/if}
					</div>
				{/if}
			{/if}

			<!-- Content -->
			<div class="flex-1 overflow-auto bg-surface-container-low relative">
				{#if loading}
					<div class="flex items-center justify-center p-12">
						<div class="m3-progress-circular m3-progress-circular-sm"></div>
					</div>

				{:else if isImage && blobUrl}
					<div class="flex items-center justify-center p-6 min-h-[300px]">
						<img src={blobUrl} alt={fileName} class="max-w-full max-h-[70vh] object-contain rounded-xl" />
					</div>

				{:else if isVideo && blobUrl}
					<div class="flex items-center justify-center p-6">
						<!-- svelte-ignore a11y_media_has_caption -->
						<video src={blobUrl} controls class="max-w-full max-h-[70vh] rounded-xl">
							Your browser does not support video playback.
						</video>
					</div>

				{:else if isAudio && blobUrl}
					<div class="flex flex-col items-center justify-center p-12 gap-6">
						<div class="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
							<span class="material-symbols-outlined text-[48px] text-primary">music_note</span>
						</div>
						<audio src={blobUrl} controls class="w-full max-w-md">
							Your browser does not support audio playback.
						</audio>
					</div>

				{:else if isPdf && blobUrl}
					<iframe src={blobUrl} title={fileName} class="w-full h-[75vh] border-none"></iframe>

				{:else if isText && textContent}
					<pre class="p-6 m3-body-small font-mono leading-relaxed whitespace-pre-wrap break-words text-on-surface">{textContent}</pre>

				{:else}
					<div class="flex flex-col items-center justify-center p-12 gap-4">
						<div class="w-20 h-20 rounded-2xl flex items-center justify-center" style="background: {fi.color}10;">
							<span class="material-symbols-outlined text-[40px]" style="color: {fi.color};">{fi.icon}</span>
						</div>
						<div class="text-center">
							<p class="m3-title-medium text-on-surface mb-1">{fileName}</p>
							<p class="m3-body-medium text-on-surface-variant">{formatFileSize(fileSize)}</p>
							{#if mimeType}<p class="m3-label-small text-on-surface-variant mt-1">{mimeType}</p>{/if}
						</div>
						<a href={downloadUrl} class="m3-btn m3-btn-filled mt-2">
							<span class="material-symbols-outlined text-[18px]">download</span>
							{t('files.download')}
						</a>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

<ConfirmDialog
	open={confirmRestore.open}
	title={t('versions.restoreTitle')}
	message={t('versions.restoreMsg', { n: String(confirmRestore.versionNumber) })}
	confirmLabel={t('versions.restore')}
	onconfirm={doRestore}
	oncancel={() => confirmRestore = { open: false, versionId: '', versionNumber: 0 }}
/>
