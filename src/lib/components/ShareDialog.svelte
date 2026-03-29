<script lang="ts">
	import Tooltip from '$lib/components/Tooltip.svelte';
	let { fileId, fileName, open = false, onclose }: { fileId: string; fileName: string; open: boolean; onclose: () => void } = $props();

	let password = $state(''); let expiresIn = $state(''); let maxDownloads = $state('');
	let shareUrl = $state(''); let loading = $state(false); let copied = $state(false); let errorMsg = $state('');

	async function createShare() {
		loading = true; errorMsg = '';
		try {
			const res = await fetch('/api/share/create', { method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ fileId, password: password || undefined, expiresIn: expiresIn ? Number(expiresIn) : undefined, maxDownloads: maxDownloads ? Number(maxDownloads) : undefined }) });
			if (!res.ok) { errorMsg = 'Failed to create share'; return; }
			shareUrl = (await res.json()).url;
		} catch { errorMsg = 'Network error'; } finally { loading = false; }
	}

	async function copyUrl() { await navigator.clipboard.writeText(shareUrl); copied = true; setTimeout(() => copied = false, 2000); }
	function reset() { password = ''; expiresIn = ''; maxDownloads = ''; shareUrl = ''; loading = false; copied = false; errorMsg = ''; }
	function close() { reset(); onclose(); }
	$effect(() => { if (open) reset(); });
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="m3-dialog-backdrop" onclick={(e) => { if (e.target === e.currentTarget) close(); }} onkeydown={(e) => { if (e.key === 'Escape') close(); }}>
		<div class="m3-dialog max-w-md">
			<!-- Header -->
			<div class="px-6 pt-6 pb-2 flex items-start justify-between">
				<div>
					<h3 class="text-lg font-semibold text-on-surface">Share file</h3>
					<p class="text-xs text-on-surface-variant mt-0.5 truncate max-w-[280px]">{fileName}</p>
				</div>
				<Tooltip text="Close"><button onclick={close} aria-label="Close" class="m3-icon-btn -mr-2 -mt-1">
					<span class="material-symbols-outlined">close</span>
				</button></Tooltip>
			</div>

			<div class="px-6 pb-6 pt-2">
				{#if shareUrl}
					<div class="space-y-4">
						<div class="m3-card flex items-start gap-2">
							<span class="material-symbols-outlined text-primary text-lg mt-0.5">check_circle</span>
							<p class="text-sm text-on-surface">Share link created!</p>
						</div>
						<div class="flex gap-2">
							<input type="text" value={shareUrl} readonly onclick={(e) => (e.target as HTMLInputElement).select()}
								class="m3-input flex-1 !h-10 bg-surface-container-low select-all" />
							<button onclick={copyUrl} class="m3-btn m3-btn-filled !h-10 flex-shrink-0">
								<span class="material-symbols-outlined text-lg">{copied ? 'check' : 'content_copy'}</span>
								{copied ? 'Copied' : 'Copy'}
							</button>
						</div>
					</div>
				{:else}
					<div class="space-y-4">
						{#if errorMsg}
							<div class="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3">{errorMsg}</div>
						{/if}
						<div>
							<label class="m3-label">Password <span class="text-outline font-normal">(optional)</span></label>
							<input type="password" bind:value={password} placeholder="Leave empty for no password" class="m3-input" />
						</div>
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="m3-label">Expires in <span class="text-outline font-normal">(hours)</span></label>
								<input type="number" bind:value={expiresIn} min="1" placeholder="Never" class="m3-input" />
							</div>
							<div>
								<label class="m3-label">Max downloads</label>
								<input type="number" bind:value={maxDownloads} min="1" placeholder="Unlimited" class="m3-input" />
							</div>
						</div>
						<button onclick={createShare} disabled={loading} class="m3-btn m3-btn-filled w-full">
							<span class="material-symbols-outlined text-lg">link</span>
							{loading ? 'Creating...' : 'Create share link'}
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
