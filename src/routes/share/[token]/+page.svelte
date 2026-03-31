<script lang="ts">
	import { formatFileSize } from '$lib/utils/filesize';
	import { t } from '$lib/i18n/index.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let password = $state(''); let errorMsg = $state(''); let downloading = $state(false);
	let previewReady = $state(false); let textContent = $state(''); let previewLoading = $state(false);
	const unavailable = $derived(data.expired || data.exhausted);
	const mime = $derived(data.fileMimeType || '');
	const isImage = $derived(!data.isFolder && mime.startsWith('image/'));
	const isVideo = $derived(!data.isFolder && mime.startsWith('video/'));
	const isAudio = $derived(!data.isFolder && mime.startsWith('audio/'));
	const isPdf = $derived(!data.isFolder && mime === 'application/pdf');
	const isText = $derived(!data.isFolder && (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('javascript') || mime.includes('yaml') || mime.includes('csv')));
	const hasPreview = $derived(isImage || isVideo || isAudio || isPdf || isText);
	const previewUrl = $derived(`/api/share/${data.token}?preview${data.hasPassword && password ? '&password=' + encodeURIComponent(password) : ''}`);

	// Folder browsing state
	type BrowseItem = { id: string; name: string; mimeType: string | null; size: number; isFolder: boolean; updatedAt: string };
	let folderItems: BrowseItem[] = $state([]);
	let folderPath: string[] = $state([]);
	let folderLoading = $state(false);
	let folderUnlocked = $state(false);

	function fileIcon(m: string, isFolder = false): { icon: string; color: string } {
		if (isFolder) return { icon: 'folder', color: '#5f6368' };
		if (!m) return { icon: 'description', color: '#9ca3af' };
		if (m.startsWith('image/')) return { icon: 'image', color: '#14b8a6' };
		if (m.startsWith('video/')) return { icon: 'movie', color: '#ec4899' };
		if (m.startsWith('audio/')) return { icon: 'music_note', color: '#f97316' };
		if (m.includes('pdf')) return { icon: 'picture_as_pdf', color: '#ea4335' };
		if (m.includes('spreadsheet') || m.includes('excel')) return { icon: 'table_chart', color: '#34a853' };
		if (m.includes('document') || m.includes('msword')) return { icon: 'description', color: '#4285f4' };
		if (m.includes('zip') || m.includes('tar') || m.includes('rar')) return { icon: 'folder_zip', color: '#f59e0b' };
		if (m.startsWith('text/') || m.includes('json')) return { icon: 'code', color: '#10b981' };
		return { icon: 'description', color: '#9ca3af' };
	}

	const fi = $derived(fileIcon(mime, data.isFolder));

	async function loadFolderContents(subpath = '') {
		folderLoading = true; errorMsg = '';
		const params = new URLSearchParams();
		if (subpath) params.set('path', subpath);
		if (data.hasPassword && password) params.set('password', password);
		try {
			const res = await fetch(`/api/share/${data.token}/browse?${params}`);
			if (!res.ok) { errorMsg = (await res.json().catch(() => ({}))).message || 'Failed to load folder'; folderLoading = false; return; }
			const result = await res.json();
			folderItems = result.items;
			folderUnlocked = true;
		} catch { errorMsg = 'Network error'; } finally { folderLoading = false; }
	}

	function navigateToSubfolder(name: string) {
		folderPath = [...folderPath, name];
		loadFolderContents(folderPath.join('/'));
	}

	function navigateUp() {
		folderPath = folderPath.slice(0, -1);
		loadFolderContents(folderPath.join('/'));
	}

	function navigateToBreadcrumb(index: number) {
		folderPath = folderPath.slice(0, index);
		loadFolderContents(folderPath.join('/'));
	}

	async function downloadSingleFile(fileId: string, fileName: string) {
		errorMsg = '';
		const params = new URLSearchParams();
		params.set('fileId', fileId);
		if (data.hasPassword && password) params.set('password', password);
		try {
			const res = await fetch(`/api/share/${data.token}?${params}`);
			if (!res.ok) { errorMsg = 'Download failed'; return; }
			const blob = await res.blob();
			const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click(); URL.revokeObjectURL(a.href);
		} catch { errorMsg = 'Network error'; }
	}

	async function downloadZip() {
		downloading = true; errorMsg = '';
		const params = new URLSearchParams();
		if (data.hasPassword && password) params.set('password', password);
		try {
			const res = await fetch(`/api/share/${data.token}?${params}`);
			if (!res.ok) { errorMsg = (await res.json().catch(() => ({}))).message || 'Download failed'; downloading = false; return; }
			const blob = await res.blob();
			const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${data.fileName}.zip`; a.click(); URL.revokeObjectURL(a.href);
		} catch { errorMsg = 'Network error'; } finally { downloading = false; }
	}

	async function download() {
		if (data.isFolder) { downloadZip(); return; }
		downloading = true; errorMsg = '';
		const params = new URLSearchParams();
		if (data.hasPassword && password) params.set('password', password);
		try {
			const res = await fetch(`/api/share/${data.token}?${params}`);
			if (!res.ok) { errorMsg = (await res.json().catch(() => ({}))).message || 'Download failed'; downloading = false; return; }
			const blob = await res.blob();
			const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = data.fileName; a.click(); URL.revokeObjectURL(a.href);
		} catch { errorMsg = 'Network error'; } finally { downloading = false; }
	}

	async function unlockPreview() {
		if (data.hasPassword && !password) return;
		if (data.isFolder) { loadFolderContents(); return; }
		previewLoading = true; errorMsg = '';
		try {
			if (isText && data.fileSize < 500_000) {
				const res = await fetch(previewUrl);
				if (!res.ok) { errorMsg = 'Wrong password'; previewLoading = false; return; }
				textContent = await res.text();
			}
			previewReady = true;
		} catch { errorMsg = 'Failed to load preview'; } finally { previewLoading = false; }
	}

	// Auto-load preview/folder if no password required
	$effect(() => {
		if (!data.hasPassword && !unavailable) {
			if (data.isFolder) loadFolderContents();
			else if (hasPreview) unlockPreview();
		}
	});
</script>

<svelte:head><title>{data.fileName} — {t('app.name')}</title></svelte:head>

<div class="min-h-screen bg-surface-container-low flex flex-col items-center justify-center px-4 py-8">
	<div class="w-full max-w-2xl">
		<!-- Logo -->
		<div class="flex items-center justify-center gap-2 mb-6">
			<span class="material-symbols-outlined text-primary text-2xl">cloud</span>
			<span class="m3-title-medium font-bold text-on-surface tracking-tight">LiteCloud</span>
		</div>

		<div class="bg-surface-container-lowest rounded-[1.75rem] overflow-hidden border border-outline-variant/30" style="box-shadow: var(--m3-elevation-1);">

			<!-- Header -->
			<div class="px-6 py-5 flex items-center gap-4 border-b border-outline-variant/15">
				<div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background: {fi.color}12;">
					<span class="material-symbols-outlined text-[24px]" style="color: {fi.color}; {data.isFolder ? "font-variation-settings: 'FILL' 1;" : ''}">{fi.icon}</span>
				</div>
				<div class="flex-1 min-w-0">
					<p class="m3-body-large font-medium text-on-surface truncate">{data.fileName}</p>
					{#if data.isFolder}
						<p class="m3-label-small text-on-surface-variant">{data.folderItemCount} item{data.folderItemCount !== 1 ? 's' : ''} &middot; {formatFileSize(data.folderTotalSize)}</p>
					{:else}
						<p class="m3-label-small text-on-surface-variant">{formatFileSize(data.fileSize)}{mime ? ` \u00B7 ${mime.split('/').pop()?.toUpperCase()}` : ''}</p>
					{/if}
				</div>
			</div>

			{#if unavailable}
				<div class="text-center py-12 px-6">
					<div class="w-14 h-14 mx-auto mb-4 bg-error-container rounded-full flex items-center justify-center">
						<span class="material-symbols-outlined text-[28px] text-on-error-container">block</span>
					</div>
					<p class="m3-title-small text-on-surface">{data.expired ? t('share.expired') : t('share.limitReached')}</p>
					<p class="m3-body-small text-on-surface-variant mt-1">{t('share.unavailable', { type: data.isFolder ? t('files.folder') : 'file' })}</p>
				</div>
			{:else}

				<!-- Folder browsing -->
				{#if data.isFolder && folderUnlocked}
					<div class="border-b border-outline-variant/15">
						<!-- Breadcrumb -->
						<div class="px-6 py-3 flex items-center gap-1.5 text-sm overflow-x-auto">
							<button onclick={() => navigateToBreadcrumb(0)} class="text-primary hover:underline flex-shrink-0 cursor-pointer">{data.fileName}</button>
							{#each folderPath as segment, i}
								<span class="text-on-surface-variant flex-shrink-0">/</span>
								<button onclick={() => navigateToBreadcrumb(i + 1)} class="text-primary hover:underline flex-shrink-0 cursor-pointer">{segment}</button>
							{/each}
						</div>

						<!-- File list -->
						<div class="max-h-[45vh] overflow-y-auto">
							{#if folderLoading}
								<div class="flex items-center justify-center py-8">
									<div class="m3-progress-circular m3-progress-circular-sm"></div>
								</div>
							{:else if folderItems.length === 0}
								<div class="text-center py-8">
									<span class="material-symbols-outlined text-3xl text-outline-variant mb-2">folder_off</span>
									<p class="m3-body-small text-on-surface-variant">{t('share.emptyFolder')}</p>
								</div>
							{:else}
								{#if folderPath.length > 0}
									<button onclick={navigateUp}
										class="w-full px-6 py-2.5 flex items-center gap-3 hover:bg-surface-container-high/50 transition-colors cursor-pointer">
										<span class="material-symbols-outlined text-on-surface-variant text-[20px]">arrow_upward</span>
										<span class="m3-body-small text-on-surface-variant">..</span>
									</button>
								{/if}
								{#each folderItems as item (item.id)}
									{@const icon = fileIcon(item.mimeType || '', item.isFolder ?? false)}
									<div class="w-full px-6 py-2.5 flex items-center gap-3 hover:bg-surface-container-high/50 transition-colors group">
										<div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background: {icon.color}10;">
											<span class="material-symbols-outlined text-[18px]" style="color: {icon.color}; {item.isFolder ? "font-variation-settings: 'FILL' 1;" : ''}">{icon.icon}</span>
										</div>
										<div class="flex-1 min-w-0">
											{#if item.isFolder}
												<button onclick={() => navigateToSubfolder(item.name)} class="m3-body-small font-medium text-on-surface truncate block text-left cursor-pointer hover:text-primary">
													{item.name}
												</button>
											{:else}
												<span class="m3-body-small font-medium text-on-surface truncate block">{item.name}</span>
											{/if}
										</div>
										<span class="m3-label-small text-on-surface-variant flex-shrink-0">
											{item.isFolder ? '' : formatFileSize(item.size)}
										</span>
										{#if !item.isFolder}
											<button onclick={() => downloadSingleFile(item.id, item.name)}
												class="m3-icon-btn !w-7 !h-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" aria-label="Download {item.name}">
												<span class="material-symbols-outlined text-[16px]">download</span>
											</button>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
					</div>

				<!-- File preview -->
				{:else if previewReady && hasPreview}
					<div class="bg-surface-container-low">
						{#if isImage}
							<div class="flex items-center justify-center p-6 min-h-[200px]">
								<img src={previewUrl} alt={data.fileName} class="max-w-full max-h-[50vh] object-contain rounded-xl" />
							</div>
						{:else if isVideo}
							<div class="flex items-center justify-center p-6">
								<!-- svelte-ignore a11y_media_has_caption -->
								<video src={previewUrl} controls class="max-w-full max-h-[50vh] rounded-xl">
									Your browser does not support video playback.
								</video>
							</div>
						{:else if isAudio}
							<div class="flex flex-col items-center justify-center p-8 gap-4">
								<div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
									<span class="material-symbols-outlined text-[32px] text-primary">music_note</span>
								</div>
								<audio src={previewUrl} controls class="w-full max-w-md">
									Your browser does not support audio playback.
								</audio>
							</div>
						{:else if isPdf}
							<iframe src={previewUrl} title={data.fileName} class="w-full h-[50vh] border-none"></iframe>
						{:else if isText && textContent}
							<div class="max-h-[40vh] overflow-auto">
								<pre class="p-6 m3-body-small font-mono leading-relaxed whitespace-pre-wrap break-words text-on-surface">{textContent}</pre>
							</div>
						{/if}
					</div>
				{:else if previewLoading || folderLoading}
					<div class="flex items-center justify-center py-12">
						<div class="m3-progress-circular m3-progress-circular-sm"></div>
					</div>
				{/if}

				<!-- Actions -->
				<div class="px-6 py-5">
					{#if data.hasPassword && !previewReady && !folderUnlocked}
						<div class="mb-4">
							<label class="m3-label">{t('share.passwordRequired')}</label>
							<input type="password" bind:value={password} placeholder="Enter share password" class="m3-input !rounded-lg"
								onkeydown={(e) => { if (e.key === 'Enter') { if (data.isFolder || hasPreview) unlockPreview(); else download(); } }} />
						</div>

						{#if data.isFolder || hasPreview}
							<button onclick={unlockPreview} disabled={!password || previewLoading || folderLoading} class="m3-btn m3-btn-tonal w-full mb-3">
								<span class="material-symbols-outlined text-[18px]">{data.isFolder ? 'folder_open' : 'visibility'}</span>
								{data.isFolder ? t('share.browseFolder') : t('files.preview')}
							</button>
						{/if}
					{/if}

					{#if errorMsg}
						<div class="m3-body-small text-error bg-error-container/30 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
							<span class="material-symbols-outlined text-[18px]">error</span>
							{errorMsg}
						</div>
					{/if}

					<button onclick={download} disabled={downloading || (data.hasPassword && !password)} class="m3-btn m3-btn-filled w-full !h-11">
						<span class="material-symbols-outlined text-[18px] m3-icon-download">download</span>
						{#if downloading}
							{t('files.download')}...
						{:else if data.isFolder}
							{t('share.downloadAsZip')}
						{:else}
							{t('files.download')}
						{/if}
					</button>

					<div class="mt-4 flex items-center justify-between m3-label-small text-on-surface-variant">
						{#if data.maxDownloads}
							<span>{data.downloadCount}/{data.maxDownloads} {t('share.downloads')}</span>
						{:else}
							<span>{data.downloadCount} {t('share.downloads')}</span>
						{/if}
						{#if data.expiresAt}
							<span>{t('share.expires', { date: new Date(data.expiresAt).toLocaleDateString() })}</span>
						{:else}
							<span>{t('share.noExpiry')}</span>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<p class="text-center m3-label-small text-on-surface-variant/50 mt-6">Powered by LiteCloud</p>
	</div>
</div>
