<script lang="ts">
	import { formatFileSize } from '$lib/utils/filesize';
	import Tooltip from '$lib/components/Tooltip.svelte';
	type Share = { id: string; token: string; fileName: string; fileSize: number; fileMimeType: string | null; hasPassword: boolean; expiresAt: string | null; downloadCount: number; maxDownloads: number | null; createdAt: string; expired: boolean; exhausted: boolean };
	let shares: Share[] = $state([]); let loading = $state(true); let copiedToken = $state('');

	async function loadShares() { loading = true; const res = await fetch('/api/share/list'); if (res.ok) shares = (await res.json()).shares; loading = false; }
	async function revoke(id: string) { if (!confirm('Revoke this share link?')) return; const res = await fetch('/api/share/revoke', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); if (res.ok) shares = shares.filter(s => s.id !== id); }
	async function copyUrl(token: string) { await navigator.clipboard.writeText(`${window.location.origin}/share/${token}`); copiedToken = token; setTimeout(() => copiedToken = '', 2000); }
	function formatDate(d: string) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d)); }
	$effect(() => { loadShares(); });
</script>

<svelte:head><title>Shared Links — LiteCloud</title></svelte:head>

<div class="px-8 py-2">
	<div class="flex items-center justify-between mb-6">
		<h2 class="m3-headline-small text-on-surface">Shared Links</h2>
		<span class="text-sm text-on-surface-variant">{shares.length} link{shares.length !== 1 ? 's' : ''}</span>
	</div>

	{#if loading}
		<div class="text-center py-20">
			<div class="m3-progress-circular m3-progress-circular-sm mx-auto"></div>
		</div>
	{:else if shares.length === 0}
		<div class="text-center py-20">
			<span class="material-symbols-outlined text-5xl text-outline-variant mb-4">link</span>
			<p class="text-lg font-medium text-on-surface">Nothing shared yet</p>
			<p class="text-sm text-on-surface-variant mt-1">Share files from the file browser to create links</p>
		</div>
	{:else}
		<div class="space-y-3">
			{#each shares as share (share.id)}
				{@const inactive = share.expired || share.exhausted}
				<div class="m3-card flex items-start gap-4 {inactive ? 'opacity-50' : ''}">
					<div class="w-10 h-10 bg-surface-container rounded-xl flex items-center justify-center flex-shrink-0">
						<span class="material-symbols-outlined text-on-surface-variant">description</span>
					</div>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 mb-1">
							<span class="text-sm font-medium text-on-surface truncate">{share.fileName}</span>
							<span class="text-xs text-on-surface-variant">{formatFileSize(share.fileSize)}</span>
						</div>
						<div class="flex items-center gap-2 flex-wrap mb-1.5">
							{#if share.hasPassword}<span class="m3-chip !h-5 !text-[10px]"><span class="material-symbols-outlined !text-[12px]">lock</span>Password</span>{/if}
							{#if share.expired}<span class="m3-chip !h-5 !text-[10px] !border-error/30 !text-error">Expired</span>
							{:else if share.expiresAt}<span class="m3-chip !h-5 !text-[10px]">Expires {new Date(share.expiresAt).toLocaleDateString()}</span>{/if}
							{#if share.exhausted}<span class="m3-chip !h-5 !text-[10px] !border-error/30 !text-error">Limit reached</span>
							{:else if share.maxDownloads}<span class="m3-chip !h-5 !text-[10px]">{share.downloadCount}/{share.maxDownloads} downloads</span>
							{:else}<span class="m3-chip !h-5 !text-[10px]">{share.downloadCount} download{share.downloadCount !== 1 ? 's' : ''}</span>{/if}
						</div>
						<p class="text-xs text-on-surface-variant">Created {formatDate(share.createdAt)}</p>
					</div>
					<div class="flex items-center gap-0.5 flex-shrink-0">
						<Tooltip text={copiedToken === share.token ? 'Copied!' : 'Copy link'}>
							<button onclick={() => copyUrl(share.token)} class="m3-icon-btn !w-9 !h-9" aria-label="Copy link">
								<span class="material-symbols-outlined text-lg {copiedToken === share.token ? 'text-primary' : ''}">{copiedToken === share.token ? 'check' : 'content_copy'}</span>
							</button>
						</Tooltip>
						<Tooltip text="Revoke link">
							<button onclick={() => revoke(share.id)} class="m3-icon-btn !w-9 !h-9" aria-label="Revoke">
								<span class="material-symbols-outlined text-lg">delete</span>
							</button>
						</Tooltip>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
