<script lang="ts">
	import { formatFileSize } from '$lib/utils/filesize';
	import { loadMasterKey, decryptFile } from '$lib/crypto';
	import { t } from '$lib/i18n/index.svelte';

	type Photo = { id: string; name: string; mimeType: string; size: number; encrypted: boolean; iv: string | null; dateTaken: string | null; createdAt: string; latitude: string | null; longitude: string | null; camera: string | null; width: number | null; height: number | null };
	let groups: Record<string, Photo[]> = $state({});
	let totalCount = $state(0);
	let totalSize = $state(0);
	let loading = $state(true);
	let lightbox = $state<Photo | null>(null);
	let lightboxUrl = $state('');
	let currentPhotoIndex = $state(0);

	const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
	function formatMonth(k: string) { const [y,m] = k.split('-'); return `${MONTHS[parseInt(m)-1]} ${y}`; }
	function photoDate(p: Photo) { return new Date(p.dateTaken || p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

	const flatPhotos = $derived(
		Object.entries(groups)
			.sort(([a], [b]) => b.localeCompare(a))
			.flatMap(([, photos]) => photos)
	);

	async function loadPhotos() {
		loading = true;
		const r = await fetch('/api/photos');
		if (r.ok) {
			const data = await r.json();
			groups = data.groups;
			totalCount = data.totalCount ?? 0;
			totalSize = data.totalSize ?? 0;
		}
		loading = false;
	}

	function thumbUrl(p: Photo, size: 'sm' | 'md' | 'lg' = 'sm') {
		if (p.encrypted) return '';
		return `/api/files/thumbnail?id=${p.id}&size=${size}`;
	}

	async function openLightbox(p: Photo) {
		lightbox = p;
		currentPhotoIndex = flatPhotos.findIndex(fp => fp.id === p.id);

		// Show lg thumbnail immediately
		lightboxUrl = thumbUrl(p, 'lg');

		if (!p.encrypted) {
			// Load full image in background
			const fullUrl = `/api/files/download?id=${p.id}`;
			const img = new Image();
			img.onload = () => { if (lightbox?.id === p.id) lightboxUrl = fullUrl; };
			img.src = fullUrl;
		} else if (p.iv) {
			const mk = await loadMasterKey();
			if (mk) {
				const r = await fetch(`/api/files/download?id=${p.id}`);
				const ct = await r.arrayBuffer();
				const pt = await decryptFile(ct, p.iv, mk);
				lightboxUrl = URL.createObjectURL(new Blob([pt], { type: p.mimeType }));
			}
		}
	}

	function closeLightbox() {
		if (lightboxUrl.startsWith('blob:')) URL.revokeObjectURL(lightboxUrl);
		lightbox = null;
		lightboxUrl = '';
	}

	function nextPhoto() {
		if (currentPhotoIndex < flatPhotos.length - 1) {
			openLightbox(flatPhotos[currentPhotoIndex + 1]);
		}
	}

	function prevPhoto() {
		if (currentPhotoIndex > 0) {
			openLightbox(flatPhotos[currentPhotoIndex - 1]);
		}
	}

	$effect(() => { loadPhotos(); });
</script>

<svelte:head><title>{t('photos.title')} — {t('app.name')}</title></svelte:head>
<svelte:window onkeydown={(e) => {
	if (!lightbox) return;
	if (e.key === 'Escape') closeLightbox();
	if (e.key === 'ArrowRight') nextPhoto();
	if (e.key === 'ArrowLeft') prevPhoto();
}} />

<div class="px-8 py-2 space-y-8">
	<div class="flex items-center justify-between">
		<h2 class="m3-headline-small text-on-surface">{t('photos.title')}</h2>
		{#if totalCount > 0}
			<span class="m3-label-medium text-on-surface-variant">{totalCount} {t('photos.title')} &middot; {formatFileSize(totalSize)}</span>
		{/if}
	</div>

	{#if loading}
		<div class="text-center py-20">
			<div class="m3-progress-circular m3-progress-circular-sm mx-auto"></div>
		</div>
	{:else if Object.keys(groups).length === 0}
		<div class="text-center py-20">
			<span class="material-symbols-outlined text-5xl text-outline-variant mb-4">photo_library</span>
			<p class="text-lg font-medium text-on-surface">{t('photos.emptyTitle')}</p>
			<p class="text-sm text-on-surface-variant mt-1">{t('photos.emptySubtitle')}</p>
		</div>
	{:else}
		{#each Object.entries(groups).sort(([a], [b]) => b.localeCompare(a)) as [month, photos] (month)}
			<div>
				<h3 class="m3-title-small text-on-surface-variant mb-3">{formatMonth(month)}</h3>
				<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-0.5">
					{#each photos as photo (photo.id)}
						<button onclick={() => openLightbox(photo)}
							class="aspect-square bg-surface-container overflow-hidden cursor-pointer relative group">
							{#if !photo.encrypted}
								<img
									src={thumbUrl(photo, 'sm')}
									alt={photo.name}
									class="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
									loading="lazy"
									decoding="async"
								/>
							{:else}
								<div class="w-full h-full flex items-center justify-center text-outline-variant">
									<span class="material-symbols-outlined text-2xl">lock</span>
								</div>
							{/if}
							<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
	<div class="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" style="animation: m3-fade-in var(--m3-duration-short3) var(--m3-ease-linear);"
		onclick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}>

		<!-- Close -->
		<button onclick={closeLightbox} aria-label={t('share.close')} class="m3-icon-btn absolute top-4 right-4 !text-white/70 hover:!text-white z-10">
			<span class="material-symbols-outlined text-2xl">close</span>
		</button>

		<!-- Prev -->
		{#if currentPhotoIndex > 0}
			<button onclick={prevPhoto} aria-label="←" class="m3-icon-btn absolute left-4 top-1/2 -translate-y-1/2 !text-white/50 hover:!text-white !bg-white/10 hover:!bg-white/20 !w-12 !h-12 z-10">
				<span class="material-symbols-outlined text-3xl">chevron_left</span>
			</button>
		{/if}

		<!-- Next -->
		{#if currentPhotoIndex < flatPhotos.length - 1}
			<button onclick={nextPhoto} aria-label="→" class="m3-icon-btn absolute right-4 top-1/2 -translate-y-1/2 !text-white/50 hover:!text-white !bg-white/10 hover:!bg-white/20 !w-12 !h-12 z-10">
				<span class="material-symbols-outlined text-3xl">chevron_right</span>
			</button>
		{/if}

		<div class="max-w-[90vw] max-h-[85vh] flex flex-col items-center" style="animation: m3-scale-in var(--m3-duration-medium2) var(--m3-ease-emphasized-decel);">
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
						<a href="https://maps.google.com/?q={lightbox.latitude},{lightbox.longitude}" target="_blank" rel="noopener" class="text-inverse-primary hover:underline">{t('photos.map')}</a>
					{/if}
					<span class="text-white/30">{currentPhotoIndex + 1} / {flatPhotos.length}</span>
				</div>
			</div>
		</div>
	</div>
{/if}
