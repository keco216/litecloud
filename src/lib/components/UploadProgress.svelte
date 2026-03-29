<script lang="ts">
	import { formatFileSize } from '$lib/utils/filesize';
	type UploadItem = { name: string; size: number; progress: number; done: boolean; error?: string };
	let { uploads = [] }: { uploads?: UploadItem[] } = $props();
	const visible = $derived(uploads.length > 0);
	const totalProgress = $derived(!uploads.length ? 0 : Math.round(uploads.reduce((s, u) => s + u.progress, 0) / uploads.length));
	const allDone = $derived(uploads.every(u => u.done));
</script>

{#if visible}
	<div class="fixed bottom-6 right-6 w-80 bg-surface-container-lowest rounded-2xl overflow-hidden z-40" style="box-shadow: 0 8px 24px rgb(0 0 0 / 12%);">
		<div class="px-4 py-3 bg-surface-container-low flex items-center justify-between">
			<div class="flex items-center gap-2">
				<span class="material-symbols-outlined text-lg {allDone ? 'text-primary' : 'text-on-surface-variant'}">
					{allDone ? 'check_circle' : 'cloud_upload'}
				</span>
				<span class="text-sm font-medium text-on-surface">
					{allDone ? 'Upload complete' : `Uploading... ${totalProgress}%`}
				</span>
			</div>
			<span class="text-xs text-on-surface-variant">{uploads.length} file{uploads.length !== 1 ? 's' : ''}</span>
		</div>
		{#if !allDone}
			<div class="m3-progress"><div class="m3-progress-fill" style="width: {totalProgress}%"></div></div>
		{/if}
		<div class="max-h-48 overflow-y-auto">
			{#each uploads as upload (upload.name)}
				<div class="px-4 py-2.5 flex items-center gap-3 border-t border-outline-variant/10">
					<span class="material-symbols-outlined text-sm {upload.error ? 'text-error' : upload.done ? 'text-primary' : 'text-on-surface-variant'}">
						{upload.error ? 'error' : upload.done ? 'check' : 'upload_file'}
					</span>
					<div class="flex-1 min-w-0">
						<p class="text-xs text-on-surface truncate">{upload.name}</p>
						<p class="text-[10px] text-on-surface-variant">{formatFileSize(upload.size)}</p>
					</div>
					{#if !upload.done && !upload.error}
						<span class="text-xs text-on-surface-variant tabular-nums">{upload.progress}%</span>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}
