<script lang="ts">
	let { currentPath = '/' }: { currentPath?: string } = $props();

	const segments = $derived.by(() => {
		const parts = currentPath.split('/').filter(Boolean);
		const crumbs: { name: string; href: string }[] = [{ name: 'Files', href: '/files' }];
		let accumulated = '';
		for (const part of parts) {
			accumulated += '/' + part;
			crumbs.push({ name: part, href: '/files' + accumulated });
		}
		return crumbs;
	});
</script>

<nav class="flex items-center gap-1 text-sm min-w-0">
	{#each segments as segment, i (segment.href)}
		{#if i > 0}
			<svg class="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
		{/if}
		{#if i === segments.length - 1}
			<span class="font-medium text-gray-900 truncate">{segment.name}</span>
		{:else}
			<a href={segment.href} class="text-gray-500 hover:text-gray-700 transition-colors truncate">
				{segment.name}
			</a>
		{/if}
	{/each}
</nav>
