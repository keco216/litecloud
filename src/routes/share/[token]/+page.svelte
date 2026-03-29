<script lang="ts">
	import { formatFileSize } from '$lib/utils/filesize';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	let password = $state(''); let errorMsg = $state(''); let downloading = $state(false);
	const unavailable = $derived(data.expired || data.exhausted);

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
</script>

<svelte:head><title>{data.fileName} — LiteCloud Share</title></svelte:head>

<div class="min-h-screen bg-surface-container-low flex items-center justify-center px-4">
	<div class="w-full max-w-[440px]">
		<!-- Logo -->
		<div class="flex items-center justify-center gap-2 mb-8">
			<span class="material-symbols-outlined text-primary text-2xl">cloud</span>
			<span class="text-xl font-bold text-on-surface tracking-tight">LiteCloud</span>
		</div>

		<div class="bg-surface-container-lowest rounded-[1.75rem] p-8" style="box-shadow: 0 1px 3px 1px rgb(0 0 0 / 15%), 0 1px 2px 0 rgb(0 0 0 / 30%);">
			<!-- File info -->
			<div class="flex items-center gap-4 mb-6">
				<div class="w-14 h-14 bg-surface-container-low rounded-2xl flex items-center justify-center">
					<span class="material-symbols-outlined text-3xl text-on-surface-variant">description</span>
				</div>
				<div class="flex-1 min-w-0">
					<p class="text-base font-medium text-on-surface truncate">{data.fileName}</p>
					<p class="text-sm text-on-surface-variant">{formatFileSize(data.fileSize)}</p>
				</div>
			</div>

			{#if unavailable}
				<div class="text-center py-6">
					<div class="w-12 h-12 mx-auto mb-3 bg-error-container rounded-full flex items-center justify-center">
						<span class="material-symbols-outlined text-on-error-container">block</span>
					</div>
					<p class="text-sm font-medium text-on-surface">{data.expired ? 'This link has expired' : 'Download limit reached'}</p>
					<p class="text-xs text-on-surface-variant mt-1">This file is no longer available.</p>
				</div>
			{:else}
				{#if data.hasPassword}
					<div class="mb-4">
						<label class="m3-label">Password</label>
						<input type="password" bind:value={password} placeholder="Enter share password" class="m3-input"
							onkeydown={(e) => { if (e.key === 'Enter') download(); }} />
					</div>
				{/if}

				{#if errorMsg}
					<div class="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3 mb-4">{errorMsg}</div>
				{/if}

				<button onclick={download} disabled={downloading || (data.hasPassword && !password)} class="m3-btn m3-btn-filled w-full !h-12">
					<span class="material-symbols-outlined text-lg">download</span>
					{downloading ? 'Downloading...' : 'Download'}
				</button>

				<div class="mt-5 flex items-center justify-between text-xs text-on-surface-variant">
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
			{/if}
		</div>

		<p class="text-center text-xs text-on-surface-variant/50 mt-6">Powered by LiteCloud</p>
	</div>
</div>
