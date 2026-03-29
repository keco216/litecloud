<script lang="ts">
	let { rows = 6 }: { rows?: number } = $props();
</script>

<!-- Google-style skeleton loading for file list -->
<div class="animate-pulse">
	<div class="flex items-center justify-between mb-4 px-8 py-2">
		<div class="h-6 bg-surface-container-high rounded-lg w-48"></div>
		<div class="flex gap-2">
			<div class="h-8 w-8 bg-surface-container-high rounded-full"></div>
			<div class="h-8 w-8 bg-surface-container-high rounded-full"></div>
		</div>
	</div>
	<div class="px-6">
		{#each Array(rows) as _, i}
			<div class="flex items-center gap-4 py-3 px-4">
				<div class="h-4 w-4 bg-surface-container-high rounded"></div>
				<div class="h-5 w-5 bg-surface-container-high rounded"></div>
				<div class="h-4 bg-surface-container-high rounded-lg" style="width: {180 + (i % 3) * 60}px"></div>
				<div class="h-4 bg-surface-container-high rounded-lg w-24 ml-auto hidden lg:block"></div>
				<div class="h-4 bg-surface-container-high rounded-lg w-16"></div>
			</div>
		{/each}
	</div>
</div>
