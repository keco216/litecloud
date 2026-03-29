<script lang="ts">
	type SortKey = 'name' | 'size' | 'updatedAt';
	type SortDir = 'asc' | 'desc';
	type ViewMode = 'list' | 'grid';

	let {
		viewMode = 'list',
		sortKey = 'name' as SortKey,
		sortDir = 'asc' as SortDir,
		selectedCount = 0,
		onviewchange,
		onsortchange,
		onupload,
		onnewfolder,
		onbulkdelete
	}: {
		viewMode?: ViewMode;
		sortKey?: SortKey;
		sortDir?: SortDir;
		selectedCount?: number;
		onviewchange?: (mode: ViewMode) => void;
		onsortchange?: (key: SortKey, dir: SortDir) => void;
		onupload?: () => void;
		onnewfolder?: () => void;
		onbulkdelete?: () => void;
	} = $props();

	function cycleSortDir(key: SortKey) {
		if (sortKey === key) {
			onsortchange?.(key, sortDir === 'asc' ? 'desc' : 'asc');
		} else {
			onsortchange?.(key, 'asc');
		}
	}
</script>

<div class="flex items-center justify-between gap-3 flex-wrap">
	<div class="flex items-center gap-2">
		<!-- Sort: M3 Segmented Button -->
		<div class="m3-segmented">
			{#each [
				{ key: 'name' as SortKey, label: 'Name' },
				{ key: 'size' as SortKey, label: 'Size' },
				{ key: 'updatedAt' as SortKey, label: 'Date' }
			] as sortOption (sortOption.key)}
				<button
					onclick={() => cycleSortDir(sortOption.key)}
					class="m3-segmented-btn {sortKey === sortOption.key ? 'active' : ''}"
				>
					{#if sortKey === sortOption.key}
						<span class="material-symbols-outlined" style="font-size: 16px;">
							{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
						</span>
					{/if}
					{sortOption.label}
				</button>
			{/each}
		</div>

		<!-- View toggle: M3 Segmented Button -->
		<div class="m3-segmented">
			<button
				onclick={() => onviewchange?.('list')}
				class="m3-segmented-btn !px-3 {viewMode === 'list' ? 'active' : ''}"
				aria-label="List view"
			>
				<span class="material-symbols-outlined" style="font-size: 20px; {viewMode === 'list' ? "font-variation-settings: 'FILL' 1;" : ''}">view_list</span>
			</button>
			<button
				onclick={() => onviewchange?.('grid')}
				class="m3-segmented-btn !px-3 {viewMode === 'grid' ? 'active' : ''}"
				aria-label="Grid view"
			>
				<span class="material-symbols-outlined" style="font-size: 20px; {viewMode === 'grid' ? "font-variation-settings: 'FILL' 1;" : ''}">grid_view</span>
			</button>
		</div>
	</div>

	<div class="flex items-center gap-2">
		{#if selectedCount > 0}
			<button
				onclick={() => onbulkdelete?.()}
				class="m3-btn m3-btn-danger !h-9"
			>
				<span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
				Delete {selectedCount}
			</button>
		{/if}

		<button
			onclick={() => onnewfolder?.()}
			class="m3-btn m3-btn-outlined !h-9"
		>
			<span class="material-symbols-outlined" style="font-size: 18px;">create_new_folder</span>
			<span class="hidden sm:inline">New folder</span>
		</button>

		<button
			onclick={() => onupload?.()}
			class="m3-btn m3-btn-filled !h-9"
		>
			<span class="material-symbols-outlined" style="font-size: 18px;">cloud_upload</span>
			Upload
		</button>
	</div>
</div>
