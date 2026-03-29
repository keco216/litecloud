<script lang="ts">
	import { getFileIconDef } from '$lib/utils/icons';

	let {
		mimeType = null,
		isFolder = false,
		name = '',
		size = 'md'
	}: { mimeType?: string | null; isFolder?: boolean; name?: string; size?: 'sm' | 'md' | 'lg' } = $props();

	const sizeMap = { sm: 'w-5 h-5', md: 'w-6 h-6', lg: 'w-10 h-10' };
	const icon = $derived(getFileIconDef(mimeType, isFolder, name));
</script>

<svg
	class="{sizeMap[size]} flex-shrink-0"
	viewBox="0 0 24 24"
	fill="none"
	stroke={icon.color}
	stroke-width="1.5"
	stroke-linecap="round"
	stroke-linejoin="round"
>
	<path d={icon.path} />
</svg>
