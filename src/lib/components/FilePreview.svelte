<script lang="ts">
	import { formatFileSize } from '$lib/utils/filesize';
	import { loadMasterKey, decryptFile } from '$lib/crypto';
	import Tooltip from '$lib/components/Tooltip.svelte';

	let { open = false, fileId = '', fileName = '', fileSize = 0, mimeType = '', encrypted = false, iv = null as string | null, onclose }:
		{ open: boolean; fileId: string; fileName: string; fileSize: number; mimeType: string; encrypted?: boolean; iv?: string | null; onclose: () => void } = $props();

	let textContent = $state(''); let loading = $state(false); let imageUrl = $state('');
	const isImage = $derived(mimeType.startsWith('image/'));
	const isText = $derived(mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('javascript') || mimeType.includes('yaml'));
	const canPreview = $derived(isImage || isText);
	const downloadUrl = $derived(`/api/files/download?id=${fileId}`);

	$effect(() => {
		if (!open) return;
		if (encrypted && iv) { loading = true; decryptForPreview().finally(() => { loading = false; }); }
		else if (isText && fileSize < 500_000) { loading = true; fetch(downloadUrl).then(r => r.text()).then(t => { textContent = t; }).catch(() => { textContent = 'Failed to load.'; }).finally(() => { loading = false; }); }
		else if (isImage) { imageUrl = downloadUrl; }
	});

	async function decryptForPreview() {
		try {
			const mk = await loadMasterKey(); if (!mk || !iv) throw new Error();
			const res = await fetch(downloadUrl); const ct = await res.arrayBuffer();
			const pt = await decryptFile(ct, iv, mk);
			if (isText) textContent = new TextDecoder().decode(pt);
			else if (isImage) imageUrl = URL.createObjectURL(new Blob([pt], { type: mimeType }));
		} catch { textContent = 'Failed to decrypt.'; }
	}

	function close() { textContent = ''; if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl); imageUrl = ''; onclose(); }
</script>

{#if open && canPreview}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" style="animation: m3-fade-in 200ms var(--m3-ease);"
		onclick={(e) => { if (e.target === e.currentTarget) close(); }} onkeydown={(e) => { if (e.key === 'Escape') close(); }}>

		<div class="bg-surface-container-lowest rounded-[1.75rem] w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" style="animation: m3-scale-in 300ms var(--m3-ease); box-shadow: 0 8px 24px rgb(0 0 0 / 20%);">
			<!-- Header -->
			<div class="px-6 py-4 flex items-center justify-between flex-shrink-0">
				<div class="min-w-0">
					<p class="text-sm font-medium text-on-surface truncate">{fileName}</p>
					<p class="text-xs text-on-surface-variant">{formatFileSize(fileSize)}</p>
				</div>
				<div class="flex items-center gap-1 flex-shrink-0">
					<Tooltip text="Download"><a href={downloadUrl} class="m3-icon-btn" aria-label="Download"><span class="material-symbols-outlined">download</span></a></Tooltip>
					<Tooltip text="Close"><button onclick={close} class="m3-icon-btn" aria-label="Close"><span class="material-symbols-outlined">close</span></button></Tooltip>
				</div>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-auto bg-surface-container-low">
				{#if isImage}
					<div class="flex items-center justify-center p-6 min-h-[300px]">
						{#if loading}
							<div class="w-6 h-6 border-2 border-outline-variant border-t-primary rounded-full animate-spin"></div>
						{:else if imageUrl}
							<img src={imageUrl} alt={fileName} class="max-w-full max-h-[70vh] object-contain rounded-xl" />
						{/if}
					</div>
				{:else if isText}
					{#if loading}
						<div class="flex items-center justify-center p-8">
							<div class="w-6 h-6 border-2 border-outline-variant border-t-primary rounded-full animate-spin"></div>
						</div>
					{:else}
						<pre class="p-6 text-sm text-on-surface font-mono leading-relaxed whitespace-pre-wrap break-words">{textContent}</pre>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}
