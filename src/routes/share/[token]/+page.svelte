<script lang="ts">
	import { formatFileSize } from '$lib/utils/filesize';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let password = $state(''); let errorMsg = $state(''); let downloading = $state(false);
	let previewReady = $state(false); let textContent = $state(''); let previewLoading = $state(false);
	const unavailable = $derived(data.expired || data.exhausted);
	const mime = $derived(data.fileMimeType || '');
	const isImage = $derived(mime.startsWith('image/'));
	const isVideo = $derived(mime.startsWith('video/'));
	const isAudio = $derived(mime.startsWith('audio/'));
	const isPdf = $derived(mime === 'application/pdf');
	const isText = $derived(mime.startsWith('text/') || mime.includes('json') || mime.includes('xml') || mime.includes('javascript') || mime.includes('yaml') || mime.includes('csv'));
	const hasPreview = $derived(isImage || isVideo || isAudio || isPdf || isText);
	const previewUrl = $derived(`/api/share/${data.token}?preview${data.hasPassword && password ? '&password=' + encodeURIComponent(password) : ''}`);

	function fileIcon(m: string): { icon: string; color: string } {
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

	const fi = $derived(fileIcon(mime));

	async function download() {
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

	// Auto-load preview if no password required
	$effect(() => { if (!data.hasPassword && !unavailable && hasPreview) unlockPreview(); });
</script>

<svelte:head><title>{data.fileName} — LiteCloud Share</title></svelte:head>

<div class="min-h-screen bg-surface-container-low flex flex-col items-center justify-center px-4 py-8">
	<div class="w-full max-w-2xl">
		<!-- Logo -->
		<div class="flex items-center justify-center gap-2 mb-6">
			<span class="material-symbols-outlined text-primary text-2xl">cloud</span>
			<span class="m3-title-medium font-bold text-on-surface tracking-tight">LiteCloud</span>
		</div>

		<div class="bg-surface-container-lowest rounded-[1.75rem] overflow-hidden border border-outline-variant/30" style="box-shadow: var(--m3-elevation-1);">

			<!-- File header -->
			<div class="px-6 py-5 flex items-center gap-4 border-b border-outline-variant/15">
				<div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style="background: {fi.color}12;">
					<span class="material-symbols-outlined text-[24px]" style="color: {fi.color};">{fi.icon}</span>
				</div>
				<div class="flex-1 min-w-0">
					<p class="m3-body-large font-medium text-on-surface truncate">{data.fileName}</p>
					<p class="m3-label-small text-on-surface-variant">{formatFileSize(data.fileSize)}{mime ? ` \u00B7 ${mime.split('/').pop()?.toUpperCase()}` : ''}</p>
				</div>
			</div>

			{#if unavailable}
				<div class="text-center py-12 px-6">
					<div class="w-14 h-14 mx-auto mb-4 bg-error-container rounded-full flex items-center justify-center">
						<span class="material-symbols-outlined text-[28px] text-on-error-container">block</span>
					</div>
					<p class="m3-title-small text-on-surface">{data.expired ? 'This link has expired' : 'Download limit reached'}</p>
					<p class="m3-body-small text-on-surface-variant mt-1">This file is no longer available.</p>
				</div>
			{:else}

				<!-- Preview area -->
				{#if previewReady && hasPreview}
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
				{:else if previewLoading}
					<div class="flex items-center justify-center py-12">
						<div class="m3-progress-circular m3-progress-circular-sm"></div>
					</div>
				{/if}

				<!-- Actions -->
				<div class="px-6 py-5">
					{#if data.hasPassword && !previewReady}
						<div class="mb-4">
							<label class="m3-label">Password required</label>
							<input type="password" bind:value={password} placeholder="Enter share password" class="m3-input !rounded-lg"
								onkeydown={(e) => { if (e.key === 'Enter') { if (hasPreview) unlockPreview(); else download(); } }} />
						</div>

						{#if hasPreview}
							<button onclick={unlockPreview} disabled={!password || previewLoading} class="m3-btn m3-btn-tonal w-full mb-3">
								<span class="material-symbols-outlined text-[18px]">visibility</span>
								Preview
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
						<span class="material-symbols-outlined text-[18px]">download</span>
						{downloading ? 'Downloading...' : 'Download'}
					</button>

					<div class="mt-4 flex items-center justify-between m3-label-small text-on-surface-variant">
						{#if data.maxDownloads}
							<span>{data.downloadCount}/{data.maxDownloads} downloads</span>
						{:else}
							<span>{data.downloadCount} download{data.downloadCount !== 1 ? 's' : ''}</span>
						{/if}
						{#if data.expiresAt}
							<span>Expires {new Date(data.expiresAt).toLocaleDateString()}</span>
						{:else}
							<span>No expiry</span>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<p class="text-center m3-label-small text-on-surface-variant/50 mt-6">Powered by LiteCloud</p>
	</div>
</div>
