<script lang="ts">
	let { open = false, title = 'Confirm', message = '', confirmLabel = 'Confirm', danger = false, onconfirm, oncancel }:
		{ open: boolean; title?: string; message: string; confirmLabel?: string; danger?: boolean; onconfirm: () => void; oncancel: () => void } = $props();
</script>

<svelte:window onkeydown={(e) => { if (open && e.key === 'Escape') oncancel(); }} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="m3-dialog-backdrop" onclick={(e) => { if (e.target === e.currentTarget) oncancel(); }}>
		<div class="m3-dialog max-w-sm">
			<div class="px-6 pt-6 pb-2">
				<div class="flex items-center gap-3 mb-3">
					<div class="w-10 h-10 rounded-full flex items-center justify-center {danger ? 'bg-error-container' : 'bg-primary/10'}">
						<span class="material-symbols-outlined text-[22px] {danger ? 'text-error' : 'text-primary'}">
							{danger ? 'delete' : 'info'}
						</span>
					</div>
					<h3 class="m3-title-medium text-on-surface">{title}</h3>
				</div>
				<p class="m3-body-medium text-on-surface-variant ml-[52px]">{message}</p>
			</div>
			<div class="px-6 py-4 flex justify-end gap-2">
				<button onclick={oncancel} class="m3-btn m3-btn-text">Cancel</button>
				<button onclick={onconfirm} class="m3-btn {danger ? 'm3-btn-danger' : 'm3-btn-filled'}">
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
