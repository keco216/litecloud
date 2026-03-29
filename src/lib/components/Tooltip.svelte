<script lang="ts">
	import type { Snippet } from 'svelte';

	let { text, children, position = 'bottom' }: {
		text: string;
		children: Snippet;
		position?: 'top' | 'bottom' | 'left' | 'right';
	} = $props();

	let show = $state(false);
	let timer: ReturnType<typeof setTimeout>;

	function enter() { timer = setTimeout(() => show = true, 400); }
	function leave() { clearTimeout(timer); show = false; }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="relative inline-flex" onmouseenter={enter} onmouseleave={leave} onfocus={enter} onblur={leave}>
	{@render children()}
	{#if show}
		<div class="absolute z-[100] pointer-events-none whitespace-nowrap px-3 py-1.5
			bg-inverse-surface text-inverse-on-surface rounded-md
			m3-body-small shadow-sm
			{position === 'bottom' ? 'top-full mt-2 left-1/2 -translate-x-1/2' : ''}
			{position === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' : ''}
			{position === 'left' ? 'right-full mr-2 top-1/2 -translate-y-1/2' : ''}
			{position === 'right' ? 'left-full ml-2 top-1/2 -translate-y-1/2' : ''}"
			style="animation: m3-tooltip-enter 150ms var(--m3-ease-decel) both;"
			role="tooltip"
		>
			{text}
		</div>
	{/if}
</div>
