<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';

	type Backup = { name: string; size: number; date: string; type: string };
	let backups: Backup[] = $state([]);
	let backupLoading = $state(false);

	async function loadBackups() { const r = await fetch('/api/backup'); if (r.ok) backups = (await r.json()).backups; }
	function fmtSize(b: number) { return b < 1048576 ? (b / 1024).toFixed(1) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; }
	$effect(() => { loadBackups(); });
</script>

<div class="mb-6">
	<h2 class="m3-headline-small text-on-surface mb-1">{t('settings.advanced')}</h2>
	<p class="m3-body-small text-on-surface-variant">{t('settings.advancedDesc')}</p>
</div>

<!-- Backups -->
<section class="mb-8">
	<h3 class="m3-label-large text-on-surface-variant uppercase tracking-wider mb-3 text-xs">{t('settings.backups')}</h3>
	<p class="text-sm text-on-surface-variant mb-3">{t('settings.backupsInfo')}</p>
	<button onclick={async () => { backupLoading = true; await fetch('/api/backup', { method: 'POST', headers: {'Content-Type':'application/json'}, body: '{"type":"daily"}' }); await loadBackups(); backupLoading = false; }}
		disabled={backupLoading} class="m3-btn m3-btn-tonal !h-9 text-xs mb-4">
		<span class="material-symbols-outlined text-base">add</span>
		{backupLoading ? t('settings.creatingBackup') : t('settings.createBackup')}
	</button>
	{#if backups.length > 0}
		<div class="space-y-1.5 max-h-48 overflow-y-auto">
			{#each backups as b (b.name)}
				<div class="flex items-center justify-between text-xs py-2 px-3 bg-surface-container rounded-lg">
					<span class="text-on-surface truncate">{b.name}</span>
					<span class="text-on-surface-variant ml-2 flex-shrink-0">{fmtSize(b.size)}</span>
				</div>
			{/each}
		</div>
	{:else}
		<p class="text-xs text-on-surface-variant">{t('settings.noBackups')}</p>
	{/if}
</section>

<hr class="border-outline-variant/15 my-6" />

<!-- WebDAV -->
<section>
	<h3 class="m3-label-large text-on-surface-variant uppercase tracking-wider mb-3 text-xs">{t('settings.webdav')}</h3>
	<p class="text-sm text-on-surface-variant mb-3">{t('settings.webdavInfo')}</p>
	<div class="bg-surface-container rounded-xl p-3 font-mono text-xs text-on-surface select-all max-w-sm">
		{typeof window !== 'undefined' ? window.location.origin : ''}/dav/
	</div>
	<p class="text-xs text-on-surface-variant mt-2">{t('settings.webdavCredentials')}</p>
</section>
