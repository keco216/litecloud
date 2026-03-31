<script lang="ts">
	import { formatFileSize } from '$lib/utils/filesize';
	import { t } from '$lib/i18n/index.svelte';

	type Category = { count: number; size: number; color: string; icon: string };
	type LargestFile = { id: string; name: string; size: number; mimeType: string | null; path: string };
	type MonthData = { uploads: number; bytes: number };
	type FolderSize = { name: string; size: number };

	let loading = $state(true);
	let total = $state({ used: 0, quota: 1073741824, fileCount: 0 });
	let categories = $state<Record<string, Category>>({});
	let largestFiles = $state<LargestFile[]>([]);
	let monthlyData = $state<Record<string, MonthData>>({});
	let topFolders = $state<FolderSize[]>([]);
	let encryption = $state({ encryptedCount: 0, encryptedSize: 0, unencryptedCount: 0, unencryptedSize: 0 });

	const usedPct = $derived(Math.min(100, Math.round((total.used / total.quota) * 100)));

	const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const CAT_LABELS: Record<string, string> = {
		images: 'storage.images', videos: 'storage.videos', audio: 'storage.audio',
		documents: 'storage.documents', pdfs: 'storage.pdfs', archives: 'storage.archives',
		code: 'storage.code', other: 'storage.other'
	};

	function donutSegments(data: { label: string; value: number; color: string }[]) {
		const tot = data.reduce((s, d) => s + d.value, 0);
		if (tot === 0) return [];
		const circ = 2 * Math.PI * 40;
		let offset = 0;
		return data.filter((d) => d.value > 0).map((d) => {
			const pct = d.value / tot;
			const seg = { ...d, pct, dasharray: `${pct * circ} ${circ}`, dashoffset: -offset };
			offset += pct * circ;
			return seg;
		});
	}

	const segments = $derived(
		donutSegments(
			Object.entries(categories)
				.filter(([, c]) => c.size > 0)
				.map(([key, c]) => ({ label: key, value: c.size, color: c.color }))
		)
	);

	const barEntries = $derived(Object.entries(monthlyData));
	const barMax = $derived(Math.max(1, ...barEntries.map(([, d]) => d.bytes)));

	function fileIcon(mime: string | null): { icon: string; color: string } {
		if (!mime) return { icon: 'description', color: '#9ca3af' };
		if (mime.startsWith('image/')) return { icon: 'image', color: '#14b8a6' };
		if (mime.startsWith('video/')) return { icon: 'movie', color: '#ec4899' };
		if (mime.startsWith('audio/')) return { icon: 'music_note', color: '#f97316' };
		if (mime.includes('pdf')) return { icon: 'picture_as_pdf', color: '#ea4335' };
		if (mime.includes('zip') || mime.includes('tar')) return { icon: 'folder_zip', color: '#f59e0b' };
		if (mime.startsWith('text/') || mime.includes('json')) return { icon: 'code', color: '#10b981' };
		return { icon: 'description', color: '#9ca3af' };
	}

	async function loadAnalytics() {
		loading = true;
		const res = await fetch('/api/storage/analytics');
		if (res.ok) {
			const data = await res.json();
			total = data.total;
			categories = data.categories;
			largestFiles = data.largestFiles;
			monthlyData = data.monthlyData;
			topFolders = data.topFolders;
			encryption = data.encryption;
		}
		loading = false;
	}

	$effect(() => { loadAnalytics(); });
</script>

<svelte:head><title>{t('storage.title')} — {t('app.name')}</title></svelte:head>

<div class="px-8 py-2 max-w-5xl">
	{#if loading}
		<div class="text-center py-20">
			<div class="m3-progress-circular m3-progress-circular-sm mx-auto"></div>
		</div>
	{:else}

		<!-- Header -->
		<div class="mb-8">
			<h2 class="m3-headline-small text-on-surface mb-2">{t('storage.title')}</h2>
			<p class="m3-title-large text-on-surface font-medium">
				{formatFileSize(total.used)} <span class="text-on-surface-variant font-normal m3-body-large">/ {formatFileSize(total.quota)}</span>
			</p>
			<p class="m3-body-small text-on-surface-variant mb-3">{t('storage.fileCount', { count: String(total.fileCount) })}</p>
			<div class="w-full h-2 rounded-full bg-surface-container-highest">
				<div class="h-2 rounded-full bg-primary transition-all duration-500" style="width: {usedPct}%"></div>
			</div>
			<p class="m3-label-small text-on-surface-variant mt-1">{usedPct}% {t('storage.usedOf', { used: formatFileSize(total.used), total: formatFileSize(total.quota) }).split(formatFileSize(total.used))[1]?.trim() || ''}</p>
		</div>

		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

			<!-- Donut Chart -->
			<div class="m3-card">
				<h3 class="m3-title-small text-on-surface mb-4">{t('storage.byType')}</h3>
				<div class="flex flex-col sm:flex-row items-center gap-6">
					<svg viewBox="0 0 100 100" class="w-36 h-36 flex-shrink-0">
						{#if segments.length === 0}
							<circle cx="50" cy="50" r="40" fill="none" stroke="var(--md-sys-color-surface-container-highest, #e0e0e0)" stroke-width="16" />
						{:else}
							{#each segments as seg}
								<circle cx="50" cy="50" r="40" fill="none"
									stroke={seg.color} stroke-width="16"
									stroke-dasharray={seg.dasharray}
									stroke-dashoffset={seg.dashoffset}
									transform="rotate(-90 50 50)"
									class="transition-all duration-500" />
							{/each}
						{/if}
						<text x="50" y="48" text-anchor="middle" class="text-lg font-semibold" fill="currentColor">{usedPct}%</text>
						<text x="50" y="60" text-anchor="middle" class="text-[9px]" fill="currentColor" opacity="0.6">{t('storage.title')}</text>
					</svg>
					<div class="flex-1 space-y-2 w-full">
						{#each Object.entries(categories).filter(([, c]) => c.count > 0) as [key, cat]}
							<div class="flex items-center gap-3">
								<div class="w-3 h-3 rounded-full flex-shrink-0" style="background: {cat.color};"></div>
								<span class="material-symbols-outlined text-[16px] text-on-surface-variant">{cat.icon}</span>
								<span class="m3-body-small text-on-surface flex-1">{t(CAT_LABELS[key] || key)}</span>
								<span class="m3-label-small text-on-surface-variant">{cat.count}</span>
								<span class="m3-label-small text-on-surface-variant w-16 text-right">{formatFileSize(cat.size)}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Encryption Overview -->
			<div class="m3-card">
				<h3 class="m3-title-small text-on-surface mb-4">{t('settings.encryption')}</h3>
				<div class="space-y-3">
					<div class="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
						<span class="material-symbols-outlined text-primary">lock</span>
						<div class="flex-1">
							<p class="m3-body-small font-medium text-on-surface">{encryption.encryptedCount} {t('storage.encrypted')}</p>
							<p class="m3-label-small text-on-surface-variant">{formatFileSize(encryption.encryptedSize)}</p>
						</div>
					</div>
					<div class="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
						<span class="material-symbols-outlined text-on-surface-variant">lock_open</span>
						<div class="flex-1">
							<p class="m3-body-small font-medium text-on-surface">{encryption.unencryptedCount} {t('storage.unencrypted')}</p>
							<p class="m3-label-small text-on-surface-variant">{formatFileSize(encryption.unencryptedSize)}</p>
						</div>
					</div>
				</div>

				<!-- Top Folders -->
				<h3 class="m3-title-small text-on-surface mt-6 mb-3">{t('storage.topFolders')}</h3>
				{#if topFolders.length === 0}
					<p class="m3-body-small text-on-surface-variant">—</p>
				{:else}
					<div class="space-y-2">
						{#each topFolders as folder}
							{@const pct = total.used > 0 ? (folder.size / total.used) * 100 : 0}
							<div>
								<div class="flex justify-between m3-label-small mb-1">
									<span class="text-on-surface">{folder.name}</span>
									<span class="text-on-surface-variant">{formatFileSize(folder.size)}</span>
								</div>
								<div class="w-full h-1.5 rounded-full bg-surface-container-highest">
									<div class="h-1.5 rounded-full bg-tertiary transition-all duration-500" style="width: {pct}%"></div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Monthly Uploads Bar Chart -->
		<div class="m3-card mb-8">
			<h3 class="m3-title-small text-on-surface mb-4">{t('storage.monthlyUploads')}</h3>
			<div class="flex items-end gap-1 h-32">
				{#each barEntries as [month, data]}
					{@const pct = barMax > 0 ? (data.bytes / barMax) * 100 : 0}
					{@const monthIdx = parseInt(month.split('-')[1]) - 1}
					<div class="flex-1 flex flex-col items-center gap-1 group relative">
						<div class="w-full rounded-t-md bg-primary/80 transition-all duration-300 group-hover:bg-primary min-h-[2px]"
							style="height: {Math.max(2, pct)}%">
						</div>
						<span class="m3-label-small text-on-surface-variant text-[9px]">{MONTH_SHORT[monthIdx]}</span>
						<!-- Tooltip -->
						<div class="absolute bottom-full mb-2 bg-inverse-surface text-inverse-on-surface px-2 py-1 rounded-lg text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
							{data.uploads} files &middot; {formatFileSize(data.bytes)}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Largest Files -->
		<div class="m3-card mb-8">
			<h3 class="m3-title-small text-on-surface mb-4">{t('storage.largestFiles')}</h3>
			{#if largestFiles.length === 0}
				<p class="m3-body-small text-on-surface-variant">—</p>
			{:else}
				<div class="space-y-1">
					{#each largestFiles as file, i}
						{@const icon = fileIcon(file.mimeType)}
						<div class="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-surface-container-high/50 transition-colors">
							<span class="m3-label-small text-on-surface-variant w-5 text-right">{i + 1}</span>
							<div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style="background: {icon.color}10;">
								<span class="material-symbols-outlined text-[16px]" style="color: {icon.color};">{icon.icon}</span>
							</div>
							<div class="flex-1 min-w-0">
								<p class="m3-body-small font-medium text-on-surface truncate">{file.name}</p>
								<p class="m3-label-small text-on-surface-variant">{file.path}</p>
							</div>
							<span class="m3-label-medium text-on-surface-variant flex-shrink-0">{formatFileSize(file.size)}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
