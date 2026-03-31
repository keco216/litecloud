<script lang="ts">
	import { t } from '$lib/i18n/index.svelte';

	type Tag = { id: string; name: string; color: string; fileCount: number };
	let userTags: Tag[] = $state([]);
	let newTagName = $state('');
	let newTagColor = $state('#9ca3af');
	let editingTagId: string | null = $state(null);
	let editTagName = $state('');
	let editTagColor = $state('');
	const TAG_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#9ca3af'];

	async function loadUserTags() { const r = await fetch('/api/tags'); if (r.ok) userTags = (await r.json()).tags; }
	async function createTag() {
		if (!newTagName.trim()) return;
		await fetch('/api/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }) });
		newTagName = ''; newTagColor = '#9ca3af'; await loadUserTags();
	}
	async function deleteTag(id: string) {
		await fetch('/api/tags', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
		await loadUserTags();
	}
	async function saveEditTag() {
		if (!editingTagId) return;
		await fetch('/api/tags', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingTagId, name: editTagName, color: editTagColor }) });
		editingTagId = null; await loadUserTags();
	}
	function startEditTag(tag: Tag) { editingTagId = tag.id; editTagName = tag.name; editTagColor = tag.color; }
	$effect(() => { loadUserTags(); });
</script>

<div class="mb-6">
	<h2 class="m3-headline-small text-on-surface mb-1">{t('tags.title')}</h2>
	<p class="m3-body-small text-on-surface-variant">{t('settings.tagsDesc')}</p>
</div>

<section class="mb-8">
	{#if userTags.length === 0}
		<p class="text-sm text-on-surface-variant mb-4">{t('tags.noTags')}</p>
	{:else}
		<div class="space-y-1 mb-6">
			{#each userTags as tag (tag.id)}
				{#if editingTagId === tag.id}
					<div class="flex items-center gap-2 p-3 bg-surface-container-low rounded-xl">
						<input type="text" bind:value={editTagName} class="m3-input !h-8 !text-sm flex-1" onkeydown={(e) => { if (e.key === 'Enter') saveEditTag(); }} />
						<div class="flex gap-1">
							{#each TAG_COLORS as c}
								<button onclick={() => editTagColor = c} class="w-5 h-5 rounded-full cursor-pointer {editTagColor === c ? 'ring-2 ring-primary ring-offset-1' : ''}" style="background: {c};"></button>
							{/each}
						</div>
						<button onclick={saveEditTag} class="m3-icon-btn !w-7 !h-7"><span class="material-symbols-outlined text-[16px]">check</span></button>
						<button onclick={() => editingTagId = null} class="m3-icon-btn !w-7 !h-7"><span class="material-symbols-outlined text-[16px]">close</span></button>
					</div>
				{:else}
					<div class="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-surface-container-high/50 group transition-colors">
						<span class="w-3.5 h-3.5 rounded-full flex-shrink-0" style="background: {tag.color};"></span>
						<span class="m3-body-medium text-on-surface flex-1">{tag.name}</span>
						<span class="m3-label-small text-on-surface-variant bg-surface-container-highest rounded-full px-2 py-0.5">{tag.fileCount}</span>
						<button onclick={() => startEditTag(tag)} class="m3-icon-btn !w-8 !h-8 opacity-0 group-hover:opacity-100"><span class="material-symbols-outlined text-[16px]">edit</span></button>
						<button onclick={() => deleteTag(tag.id)} class="m3-icon-btn !w-8 !h-8 opacity-0 group-hover:opacity-100 !text-error"><span class="material-symbols-outlined text-[16px]">delete</span></button>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</section>

<hr class="border-outline-variant/15 my-6" />

<section>
	<h3 class="m3-label-large text-on-surface-variant uppercase tracking-wider mb-3 text-xs">{t('tags.addTag')}</h3>
	<div class="flex items-center gap-3">
		<input type="text" bind:value={newTagName} placeholder={t('tags.tagName')} class="m3-input !h-9 !text-sm flex-1 max-w-xs" onkeydown={(e) => { if (e.key === 'Enter') createTag(); }} />
		<div class="flex gap-1.5">
			{#each TAG_COLORS as c}
				<button onclick={() => newTagColor = c} class="w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110 {newTagColor === c ? 'ring-2 ring-primary ring-offset-2' : ''}" style="background: {c};"></button>
			{/each}
		</div>
		<button onclick={createTag} disabled={!newTagName.trim()} class="m3-btn m3-btn-tonal !h-9 text-xs">{t('tags.addTag')}</button>
	</div>
</section>
