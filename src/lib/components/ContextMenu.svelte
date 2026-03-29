<script lang="ts">
	type MenuItem = { icon: string; label: string; action: () => void; danger?: boolean; divider?: boolean };

	let { items = [] as MenuItem[], x = 0, y = 0, open = false, onclose }:
		{ items: MenuItem[]; x: number; y: number; open: boolean; onclose: () => void } = $props();

	function handleClick(action: () => void) {
		action();
		onclose();
	}

	// Close on outside click or scroll
	function onWindowClick() { if (open) onclose(); }
</script>

<svelte:window onclick={onWindowClick} onkeydown={(e) => { if (e.key === 'Escape') onclose(); }} />

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="m3-menu fixed"
		style="left: {x}px; top: {y}px; z-index: 200;"
		onclick={(e) => e.stopPropagation()}
	>
		{#each items as item}
			{#if item.divider}
				<div class="m3-menu-divider"></div>
			{:else}
				<button
					class="m3-menu-item {item.danger ? 'm3-menu-item-danger' : ''}"
					onclick={() => handleClick(item.action)}
				>
					<span class="material-symbols-outlined">{item.icon}</span>
					<span class="m3-body-medium">{item.label}</span>
				</button>
			{/if}
		{/each}
	</div>
{/if}
