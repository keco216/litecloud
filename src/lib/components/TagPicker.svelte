<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';

	type Tag = { id: string; name: string; color: string; fileCount: number };
	type FileTag = { fileId: string; tagId: string };

	let { open = false, x = 0, y = 0, fileIds = [] as string[], fileTags = [] as FileTag[], userTags = [] as Tag[], onassign, onremove, onclose }:
		{
			open: boolean; x: number; y: number;
			fileIds: string[]; fileTags: FileTag[]; userTags: Tag[];
			onassign: (fileIds: string[], tagId: string) => void;
			onremove: (fileIds: string[], tagId: string) => void;
			onclose: () => void;
		} = $props();

	function tagState(tagId: string): 'all' | 'some' | 'none' {
		const matching = fileTags.filter(ft => ft.tagId === tagId && fileIds.includes(ft.fileId));
		if (matching.length === 0) return 'none';
		if (matching.length === fileIds.length) return 'all';
		return 'some';
	}

	function toggleTag(tagId: string) {
		const state = tagState(tagId);
		if (state === 'all') {
			onremove(fileIds, tagId);
		} else {
			onassign(fileIds, tagId);
		}
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" onclick={onclose}></div>
	<div class="fixed z-50 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 w-60 overflow-hidden"
		style="box-shadow: var(--m3-elevation-2); left: {Math.max(8, Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1000) - 260))}px; top: {Math.max(8, Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - 320))}px; animation: m3-menu-enter var(--m3-duration-short4) var(--m3-ease-emphasized-decel);">
		<div class="px-4 py-2.5 border-b border-outline-variant/15">
			<span class="m3-label-large text-on-surface">{t('tags.assignTags')}</span>
		</div>
		<div class="py-1 max-h-64 overflow-y-auto">
			{#each userTags as tag (tag.id)}
				{@const state = tagState(tag.id)}
				<button
					onclick={() => toggleTag(tag.id)}
					class="w-full px-4 py-2 flex items-center gap-3 hover:bg-surface-container-high/50 transition-colors text-left cursor-pointer"
				>
					<div class="w-[18px] h-[18px] rounded flex items-center justify-center border-2 transition-colors flex-shrink-0
						{state === 'all' ? 'bg-primary border-primary' : state === 'some' ? 'bg-primary/50 border-primary' : 'border-outline-variant'}">
						{#if state === 'all'}
							<span class="material-symbols-outlined text-on-primary text-[14px]">check</span>
						{:else if state === 'some'}
							<span class="material-symbols-outlined text-on-primary text-[14px]">remove</span>
						{/if}
					</div>
					<span class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background: {tag.color};"></span>
					<span class="m3-body-small text-on-surface flex-1">{tag.name}</span>
				</button>
			{/each}
			{#if userTags.length === 0}
				<p class="px-4 py-3 m3-body-small text-on-surface-variant">{t('tags.noTags')}</p>
			{/if}
		</div>
	</div>
{/if}
