<script lang="ts">
	import { formatFileSize } from '$lib/utils/filesize';

	let { used = 0, quota = 1073741824 }: { used?: number; quota?: number } = $props();

	const pct = $derived(Math.min(100, Math.round((used / quota) * 100)));
	const color = $derived(pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-blue-500');
</script>

<div class="px-4 py-3 border-t border-gray-100">
	<div class="flex items-center justify-between mb-1.5">
		<span class="text-[11px] font-medium text-gray-500">Storage</span>
		<span class="text-[11px] text-gray-400">{pct}%</span>
	</div>
	<div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
		<div class="{color} h-full rounded-full transition-all duration-500" style="width: {pct}%"></div>
	</div>
	<p class="text-[10px] text-gray-400 mt-1">
		{formatFileSize(used)} of {formatFileSize(quota)}
	</p>
</div>
