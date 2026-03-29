<script lang="ts">
	import { formatFileSize } from '$lib/utils/filesize';
	import { loadMasterKey, decryptFile } from '$lib/crypto';

	type Photo = { id: string; name: string; mimeType: string; size: number; encrypted: boolean; iv: string | null; dateTaken: string | null; createdAt: string; latitude: string | null; longitude: string | null; camera: string | null; width: number | null; height: number | null };
	let groups: Record<string, Photo[]> = $state({}); let loading = $state(true);
	let lightbox = $state<Photo | null>(null); let lightboxUrl = $state('');
	const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
	function formatMonth(k: string) { const [y,m] = k.split('-'); return `${MONTHS[parseInt(m)-1]} ${y}`; }
	function photoDate(p: Photo) { return new Date(p.dateTaken || p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

	async function loadPhotos() { loading = true; const r = await fetch('/api/photos'); if (r.ok) groups = (await r.json()).groups; loading = false; }

	async function openLightbox(p: Photo) {
		lightbox = p; lightboxUrl = '';
		if (p.encrypted && p.iv) { const mk = await loadMasterKey(); if (mk) { const r = await fetch(`/api/files/download?id=${p.id}`); const ct = await r.arrayBuffer(); const pt = await decryptFile(ct, p.iv, mk); lightboxUrl = URL.createObjectURL(new Blob([pt], { type: p.mimeType })); return; } }
		lightboxUrl = `/api/files/download?id=${p.id}`;
	}
	function closeLightbox() { if (lightboxUrl.startsWith('blob:')) URL.revokeObjectURL(lightboxUrl); lightbox = null; lightboxUrl = ''; }
	function thumbUrl(p: Photo) { return p.encrypted ? '' : `/api/files/download?id=${p.id}`; }
	$effect(() => { loadPhotos(); });
</script>

<svelte:head><title>Photos — LiteCloud</title></svelte:head>
<svelte:window onkeydown={(e) => { if (e.key === 'Escape') closeLightbox(); }} />

<div class="px-8 py-2 space-y-8">
	<h2 class="m3-headline-small text-on-surface">Photos</h2>

	{#if loading}
		<div class="text-center py-20">
			<div class="m3-progress-circular m3-progress-circular-sm mx-auto"></div>
		</div>
	{:else if Object.keys(groups).length === 0}
		<div class="text-center py-20">
			<span class="material-symbols-outlined text-5xl text-outline-variant mb-4">photo_library</span>
			<p class="text-lg font-medium text-on-surface">No photos yet</p>
			<p class="text-sm text-on-surface-variant mt-1">Upload images to see them organized by date</p>
		</div>
	{:else}
		{#each Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)) as [month, photos] (month)}
			<div>
				<h3 class="m3-title-small text-on-surface-variant mb-3">{formatMonth(month)}</h3>
				<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1">
					{#each photos as photo (photo.id)}
						<button onclick={() => openLightbox(photo)}
							class="aspect-square bg-surface-container rounded-xl overflow-hidden cursor-pointer relative group transition-transform duration-200 hover:scale-[1.02]">
							{#if !photo.encrypted}
								<img src={thumbUrl(photo)} alt={photo.name} class="w-full h-full object-cover" loading="lazy" />
							{:else}
								<div class="w-full h-full flex items-center justify-center text-outline-variant">
									<span class="material-symbols-outlined text-3xl">lock</span>
								</div>
							{/if}
							<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
								<p class="text-[10px] text-white truncate">{photo.name}</p>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/each}
	{/if}
</div>

<!-- Lightbox -->
{#if lightbox}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" style="animation: m3-fade-in 200ms var(--m3-ease);"
		onclick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}>
		<button onclick={closeLightbox} aria-label="Close" class="m3-icon-btn absolute top-4 right-4 !text-white/70 hover:!text-white z-10">
			<span class="material-symbols-outlined text-2xl">close</span>
		</button>

		<div class="max-w-[90vw] max-h-[85vh] flex flex-col items-center" style="animation: m3-scale-in 300ms var(--m3-ease);">
			{#if lightboxUrl}
				<img src={lightboxUrl} alt={lightbox.name} class="max-w-full max-h-[75vh] object-contain rounded-xl" />
			{:else}
				<div class="m3-progress-circular m3-progress-circular-sm !border-white/30 !border-t-white"></div>
			{/if}
			<div class="mt-4 text-center text-white/80">
				<p class="text-sm font-medium">{lightbox.name}</p>
				<div class="flex items-center justify-center gap-4 mt-1 text-xs text-white/50">
					<span>{photoDate(lightbox)}</span>
					<span>{formatFileSize(lightbox.size)}</span>
					{#if lightbox.width && lightbox.height}<span>{lightbox.width} x {lightbox.height}</span>{/if}
					{#if lightbox.camera}<span>{lightbox.camera}</span>{/if}
					{#if lightbox.latitude && lightbox.longitude}
						<a href="https://maps.google.com/?q={lightbox.latitude},{lightbox.longitude}" target="_blank" rel="noopener" class="text-inverse-primary hover:underline">Map</a>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
