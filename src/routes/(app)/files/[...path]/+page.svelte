<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { formatFileSize } from '$lib/utils/filesize';
	import { getFileIconDef } from '$lib/utils/icons';
	import UploadProgress from '$lib/components/UploadProgress.svelte';
	import ShareDialog from '$lib/components/ShareDialog.svelte';
	import FilePreview from '$lib/components/FilePreview.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import ContextMenu from '$lib/components/ContextMenu.svelte';
	import TagPicker from '$lib/components/TagPicker.svelte';
	import { loadMasterKey, encryptFile, decryptFile, unlockMasterKey, storeMasterKey } from '$lib/crypto';
	import { browser } from '$app/environment';
	import { t } from '$lib/i18n/index.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Encryption unlock
	let showUnlockPrompt = $state(false);
	let unlockPassword = $state('');
	let unlockError = $state('');
	let unlockLoading = $state(false);
	let pendingUploadFiles = $state<FileList | null>(null);

	// Check if encryption is active but key is missing from sessionStorage
	$effect(() => {
		if (browser && data.hasEncryption) {
			const hasKey = !!localStorage.getItem('lc-mk');
			if (!hasKey) showUnlockPrompt = true;
		}
	});

	async function doEncryptionUnlock() {
		if (!unlockPassword) return;
		unlockLoading = true;
		unlockError = '';
		try {
			const k = await unlockMasterKey(unlockPassword, data.encryptionSalt, data.encryptedMasterKey, data.masterKeyIv);
			await storeMasterKey(k);
			showUnlockPrompt = false;
			unlockPassword = '';
			// If there were pending uploads, process them now
			if (pendingUploadFiles) {
				const files = pendingUploadFiles;
				pendingUploadFiles = null;
				uploadFiles(files);
			}
		} catch {
			unlockError = t('settings.encryptionSetupError');
		} finally {
			unlockLoading = false;
		}
	}

	// State
	let shareFileId = $state(''); let shareFileName = $state(''); let shareIsFolder = $state(false); let shareOpen = $state(false);
	let previewOpen = $state(false);
	let previewFile = $state({ id: '', name: '', size: 0, mimeType: '', encrypted: false, iv: null as string | null });

	type SortKey = 'name' | 'size' | 'updatedAt';
	type SortDir = 'asc' | 'desc';
	type ViewMode = 'list' | 'grid';
	type UploadItem = { name: string; size: number; progress: number; done: boolean; error?: string };

	let viewMode: ViewMode = $state((browser && localStorage.getItem('lc-view') as ViewMode) || 'list');
	let sortKey: SortKey = $state('name');
	let sortDir: SortDir = $state('asc');
	let selected = $state(new Set<string>());
	let dragging = $state(false);
	let dragCounter = $state(0);
	let internalDrag = $state(false);
	let uploads: UploadItem[] = $state([]);
	let renamingId: string | null = $state(null);
	let renameValue = $state('');
	let showShortcuts = $state(false);
	let moveDialogOpen = $state(false);
	let confirmDelete = $state({ open: false, ids: [] as string[] });
	let moveFileIds: string[] = $state([]);
	let moveFolders: { name: string; path: string }[] = $state([]);
	let ctxMenu = $state({ open: false, x: 0, y: 0, file: null as typeof data.files[0] | null });
	let tagPicker = $state({ open: false, x: 0, y: 0, fileIds: [] as string[] });

	// Collect all file-tag pairs for the TagPicker
	const allFileTags = $derived(
		data.files.flatMap((f: any) => (f.tags || []).map((t: any) => ({ fileId: f.id, tagId: t.id })))
	);

	function openTagPicker(fileIds: string[], x: number, y: number) {
		tagPicker = { open: true, x, y, fileIds };
	}

	// Tags + Favorites
	type UserTag = { id: string; name: string; color: string; fileCount: number };
	let userTags: UserTag[] = $state([]);
	let activeFilters = $state(new Set<string>());

	async function loadTags() {
		const res = await fetch('/api/tags');
		if (res.ok) userTags = (await res.json()).tags;
	}

	async function toggleStar(fileId: string, starred: boolean) {
		await fetch('/api/files/star', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [fileId], starred }) });
		await invalidateAll();
	}

	async function assignTag(fileIds: string[], tagId: string) {
		await fetch('/api/tags/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileIds, tagId }) });
		await invalidateAll(); loadTags();
	}

	async function removeTag(fileIds: string[], tagId: string) {
		await fetch('/api/tags/assign', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileIds, tagId }) });
		await invalidateAll(); loadTags();
	}

	function toggleFilter(key: string) {
		const next = new Set(activeFilters);
		if (next.has(key)) next.delete(key); else next.add(key);
		activeFilters = next;
	}

	$effect(() => { if (browser) loadTags(); });

	function onContextMenu(e: MouseEvent, file: typeof data.files[0]) {
		e.preventDefault();
		ctxMenu = { open: true, x: e.clientX, y: e.clientY, file };
	}

	function getCtxMenuItems(file: typeof data.files[0]) {
		const items: { icon: string; label: string; action: () => void; danger?: boolean; divider?: boolean }[] = [];
		if (file.isFolder) items.push({ icon: 'folder_open', label: t('files.open'), action: () => openItem(file) });
		else items.push({ icon: 'visibility', label: t('files.preview'), action: () => openPreview(file) });
		items.push({ icon: 'edit', label: t('files.rename'), action: () => startRename(file.id, file.name) });
		items.push({ icon: 'drive_file_move', label: t('files.moveTo'), action: () => openMoveDialog([file.id]) });
		items.push({ icon: 'label', label: t('tags.assignTags'), action: () => openTagPicker([file.id], ctxMenu.x, ctxMenu.y) });
		items.push({ icon: 'share', label: t('files.share'), action: () => openShare(file.id, file.name, file.isFolder ?? false) });
		if (!file.isFolder) {
			items.push({ icon: 'download', label: t('files.download'), action: () => downloadFile(file.id, file.name, file.encrypted ?? false, file.iv ?? null) });
		}
		items.push({ icon: '', label: '', action: () => {}, divider: true });
		items.push({ icon: 'delete', label: t('files.delete'), action: () => deleteFiles([file.id]), danger: true });
		return items;
	}
	let showNewFolder = $state(false);
	let newFolderName = $state('');
	let fileInput: HTMLInputElement;
	let renameInput: HTMLInputElement | undefined;
	let folderInput: HTMLInputElement | undefined;

	// Sorted + filtered files (folders first)
	const sortedFiles = $derived.by(() => {
		let items = [...data.files];

		// Apply filters
		if (activeFilters.size > 0) {
			items = items.filter((f) => {
				for (const filter of activeFilters) {
					if (filter === 'starred' && !f.starred) return false;
					if (filter.startsWith('tag:')) {
						const tagId = filter.slice(4);
						if (!(f as any).tags?.some((t: any) => t.id === tagId)) return false;
					}
				}
				return true;
			});
		}

		items.sort((a, b) => {
			if (a.isFolder && !b.isFolder) return -1;
			if (!a.isFolder && b.isFolder) return 1;
			let cmp = 0;
			if (sortKey === 'name') cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
			else if (sortKey === 'size') cmp = a.size - b.size;
			else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return items;
	});

	const allSelected = $derived(data.files.length > 0 && selected.size === data.files.length);

	// Breadcrumb segments
	const breadcrumbs = $derived.by(() => {
		const parts = data.currentPath.split('/').filter(Boolean);
		const crumbs: { name: string; href: string }[] = [{ name: t('nav.files'), href: '/files' }];
		let acc = '';
		for (const p of parts) { acc += '/' + p; crumbs.push({ name: p, href: '/files' + acc }); }
		return crumbs;
	});

	// Material icon for file type
	function fileIcon(mime: string | null, isFolder: boolean): { icon: string; color: string } {
		if (isFolder) return { icon: 'folder', color: '#5f6368' };
		if (!mime) return { icon: 'description', color: '#9ca3af' };
		if (mime.startsWith('image/')) return { icon: 'image', color: '#14b8a6' };
		if (mime.startsWith('video/')) return { icon: 'movie', color: '#ec4899' };
		if (mime.startsWith('audio/')) return { icon: 'music_note', color: '#f97316' };
		if (mime.includes('pdf')) return { icon: 'picture_as_pdf', color: '#ea4335' };
		if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return { icon: 'table_chart', color: '#34a853' };
		if (mime.includes('document') || mime.includes('msword')) return { icon: 'description', color: '#4285f4' };
		if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar')) return { icon: 'folder_zip', color: '#f59e0b' };
		if (mime.startsWith('text/') || mime.includes('json')) return { icon: 'code', color: '#10b981' };
		return { icon: 'description', color: '#9ca3af' };
	}

	// Upload with encryption + progress
	async function uploadFiles(fileList: FileList | null) {
		if (!fileList?.length) return;
		let masterKey: CryptoKey | null = null;
		try { masterKey = await loadMasterKey(); } catch {}
		// If encryption is active but key is missing, prompt for password first
		if (data.hasEncryption && !masterKey) {
			pendingUploadFiles = fileList;
			showUnlockPrompt = true;
			return;
		}
		for (const file of fileList) {
			const item: UploadItem = { name: file.name, size: file.size, progress: 0, done: false };
			uploads = [...uploads, item];
			try {
				let fileBlob: Blob; let iv = '';
				if (masterKey) {
					uploads = uploads.map(u => u.name === file.name && !u.done ? { ...u, progress: 10 } : u);
					const pt = await file.arrayBuffer();
					const enc = await encryptFile(pt, masterKey);
					fileBlob = new Blob([enc.ciphertext]); iv = enc.iv;
					uploads = uploads.map(u => u.name === file.name && !u.done ? { ...u, progress: 30 } : u);
				} else { fileBlob = file; }
				const fd = new FormData();
				fd.append('files', new File([fileBlob], file.name, { type: file.type }));
				fd.append('path', data.currentPath);
				if (iv) fd.append('iv', iv);
				fd.append('encrypted', masterKey ? '1' : '0');
				const xhr = new XMLHttpRequest();
				xhr.open('POST', '/api/files/upload');
				xhr.upload.onprogress = (e) => {
					if (e.lengthComputable) {
						const base = masterKey ? 30 : 0, range = masterKey ? 70 : 100;
						const pct = Math.round(base + (e.loaded / e.total) * range);
						uploads = uploads.map(u => u.name === file.name && !u.done ? { ...u, progress: pct } : u);
					}
				};
				xhr.onload = () => {
						let uploadError: string | undefined;
						if (xhr.status >= 400) {
							try { const body = JSON.parse(xhr.responseText); uploadError = body.message || `Error ${xhr.status}`; } catch { uploadError = `Error ${xhr.status}`; }
							console.error('[upload] Server error:', xhr.status, xhr.responseText);
						}
						uploads = uploads.map(u => u.name === file.name ? { ...u, progress: 100, done: true, error: uploadError } : u); invalidateAll(); setTimeout(() => { uploads = uploads.filter(u => !(u.name === file.name && u.done)); }, 5000);
					};
				xhr.onerror = () => { uploads = uploads.map(u => u.name === file.name ? { ...u, done: true, error: 'Network error' } : u); };
				xhr.send(fd);
			} catch { uploads = uploads.map(u => u.name === file.name ? { ...u, done: true, error: 'Upload failed' } : u); }
		}
	}

	function deleteFiles(ids: string[]) {
		confirmDelete = { open: true, ids };
	}

	async function executeDelete() {
		const ids = confirmDelete.ids;
		confirmDelete = { open: false, ids: [] };
		const res = await fetch('/api/files/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) });
		if (res.ok) {
			const result = await res.json();
			const deletedIds: string[] = result.ids || ids;
			const count = result.deleted || ids.length;
			selected = new Set();
			await invalidateAll();
			(window as any).__lc_toast?.(t('trash.movedToTrash', { count: String(count) }), 'info', {
				label: t('trash.undo'),
				callback: async () => {
					await fetch('/api/files/trash', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'restore', ids: deletedIds }) });
					await invalidateAll();
				}
			});
		}
	}

	async function downloadFile(fileId: string, fileName: string, isEncrypted: boolean, iv: string | null) {
		if (!isEncrypted || !iv) { window.location.href = `/api/files/download?id=${fileId}`; return; }
		let mk: CryptoKey | null = null;
		try { mk = await loadMasterKey(); } catch { /* ignore */ }
		if (!mk) { window.location.href = `/api/files/download?id=${fileId}`; return; }
		try {
			const res = await fetch(`/api/files/download?id=${fileId}`);
			if (!res.ok) return;
			const ct = await res.arrayBuffer();
			const pt = await decryptFile(ct, iv, mk);
			const a = document.createElement('a');
			a.href = URL.createObjectURL(new Blob([pt]));
			a.download = fileName; a.click(); URL.revokeObjectURL(a.href);
		} catch { window.location.href = `/api/files/download?id=${fileId}`; }
	}

	function startRename(id: string, name: string) { renamingId = id; renameValue = name; setTimeout(() => renameInput?.select(), 0); }
	async function submitRename() {
		if (!renamingId || !renameValue.trim()) { renamingId = null; return; }
		await fetch('/api/files/rename', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: renamingId, name: renameValue.trim() }) });
		renamingId = null; await invalidateAll();
	}
	async function createFolder() {
		if (!newFolderName.trim()) { showNewFolder = false; return; }
		await fetch('/api/files/mkdir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newFolderName.trim(), path: data.currentPath }) });
		showNewFolder = false; newFolderName = ''; await invalidateAll();
	}
	function openNewFolder() { showNewFolder = true; newFolderName = ''; setTimeout(() => folderInput?.focus(), 0); }
	function toggleSelect(id: string) { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); selected = n; }
	function toggleAll() { selected = allSelected ? new Set() : new Set(data.files.map(f => f.id)); }
	function openItem(file: typeof data.files[0]) { if (file.isFolder) goto(`/files${data.currentPath === '/' ? '/' + file.name : data.currentPath + '/' + file.name}`); }
	function openPreview(file: typeof data.files[0]) {
		if (file.isFolder) return;
		const m = file.mimeType || '';
		previewFile = { id: file.id, name: file.name, size: file.size, mimeType: m, encrypted: file.encrypted ?? false, iv: file.iv ?? null };
		previewOpen = true;
	}
	function openShare(id: string, name: string, folder = false) { shareFileId = id; shareFileName = name; shareIsFolder = folder; shareOpen = true; }

	// Move files
	let dropTargetId: string | null = $state(null);

	async function moveFiles(ids: string[], targetFolder: typeof data.files[0]) {
		const targetPath = data.currentPath === '/'
			? '/' + targetFolder.name
			: data.currentPath + '/' + targetFolder.name;
		await moveToPath(ids, targetPath);
	}

	async function moveToPath(ids: string[], targetPath: string) {
		const res = await fetch('/api/files/move', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ids, targetPath })
		});
		if (res.ok) { selected = new Set(); moveDialogOpen = false; await invalidateAll(); }
	}

	function openMoveDialog(ids: string[]) {
		moveFileIds = ids;
		const folders: { name: string; path: string }[] = [];
		const addedPaths = new Set<string>();

		if (data.currentPath !== '/') {
			// Parent folder (one level up)
			const parts = data.currentPath.split('/').filter(Boolean);
			parts.pop();
			const parentPath = parts.length > 0 ? '/' + parts.join('/') : '/';
			const parentName = parentPath === '/' ? 'My Files' : parts[parts.length - 1];
			folders.push({ name: parentName, path: parentPath });
			addedPaths.add(parentPath);

			// Root if parent is not already root
			if (parentPath !== '/') {
				folders.push({ name: 'My Files', path: '/' });
				addedPaths.add('/');
			}
		}

		// Subfolders in current directory (excluding items being moved)
		for (const f of data.files) {
			if (f.isFolder && !ids.includes(f.id)) {
				const path = data.currentPath === '/' ? '/' + f.name : data.currentPath + '/' + f.name;
				if (!addedPaths.has(path)) {
					folders.push({ name: f.name, path });
					addedPaths.add(path);
				}
			}
		}

		moveFolders = folders;
		moveDialogOpen = true;
	}

	function onRowDragStart(e: DragEvent, fileId: string) {
		if (!e.dataTransfer) return;
		internalDrag = true;
		const ids = selected.size > 0 && selected.has(fileId) ? [...selected] : [fileId];
		e.dataTransfer.setData('text/plain', JSON.stringify(ids));
		e.dataTransfer.effectAllowed = 'move';
	}

	function onFolderDragOver(e: DragEvent, folderId: string) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dropTargetId = folderId;
	}

	function onFolderDragLeave() { dropTargetId = null; }

	function onFolderDrop(e: DragEvent, folder: typeof data.files[0]) {
		e.preventDefault();
		e.stopPropagation();
		dropTargetId = null;
		internalDrag = false;
		const raw = e.dataTransfer?.getData('text/plain');
		if (!raw) return;
		try {
			const ids: string[] = JSON.parse(raw);
			if (ids.includes(folder.id)) return;
			moveFiles(ids, folder);
		} catch {}
	}

	function setViewMode(m: ViewMode) { viewMode = m; if (browser) localStorage.setItem('lc-view', m); }
	function cycleSortDir(key: SortKey) { if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc'; else { sortKey = key; sortDir = 'asc'; } }
	function formatDate(d: Date) { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d)); }

	// Listen for upload trigger from sidebar FAB
	function triggerUpload() { fileInput?.click(); }
	$effect(() => {
		if (!browser) return;
		document.addEventListener('lc-upload', triggerUpload);
		return () => document.removeEventListener('lc-upload', triggerUpload);
	});

	$effect(() => { data.currentPath; selected = new Set(); });

	function onKeydown(e: KeyboardEvent) {
		const tag = (e.target as HTMLElement).tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA') return;
		if (e.key === '?') { showShortcuts = !showShortcuts; return; }
		if (e.key === 'Delete' || e.key === 'Backspace') { if (selected.size > 0) { e.preventDefault(); deleteFiles([...selected]); } }
		else if (e.key === 'Escape') { selected = new Set(); renamingId = null; showNewFolder = false; previewOpen = false; showShortcuts = false; ctxMenu = { ...ctxMenu, open: false }; }
		else if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); fileInput?.click(); }
		else if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); toggleAll(); }
	}
</script>

<svelte:window onkeydown={onKeydown} />
<svelte:head><title>{data.currentPath === '/' ? 'My Files' : data.currentPath.split('/').pop()} — LiteCloud</title></svelte:head>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="px-8 py-2 min-h-[calc(100vh-4rem)]"
	ondragenter={(e: DragEvent) => { e.preventDefault(); if (internalDrag) return; dragCounter++; dragging = true; }}
	ondragover={(e: DragEvent) => { e.preventDefault(); }}
	ondragleave={(e: DragEvent) => { e.preventDefault(); if (internalDrag) return; dragCounter--; if (dragCounter <= 0) { dragging = false; dragCounter = 0; } }}
	ondrop={(e: DragEvent) => { e.preventDefault(); if (internalDrag) { internalDrag = false; dropTargetId = null; dragging = false; dragCounter = 0; return; } dragging = false; dragCounter = 0; uploadFiles(e.dataTransfer?.files ?? null); }}
>
	<!-- Breadcrumb + View controls (Stitch toolbar) -->
	<div class="flex items-center justify-between mb-2">
		<div class="flex items-center gap-1 text-on-surface-variant">
			{#each breadcrumbs as crumb, i (crumb.href)}
				{#if i > 0}<span class="material-symbols-outlined text-[18px]">chevron_right</span>{/if}
				{#if i === breadcrumbs.length - 1}
					<span class="px-2 py-1 text-lg font-medium text-on-surface">{crumb.name}</span>
				{:else}
					<a href={crumb.href} class="hover:bg-surface-container-low px-2 py-1 rounded-lg text-lg font-medium transition-colors">{crumb.name}</a>
				{/if}
			{/each}
		</div>
		<div class="flex items-center gap-1">
			<Tooltip text={t('files.listView')}>
				<button onclick={() => setViewMode('list')} class="m3-icon-btn" aria-label="List view">
					<span class="material-symbols-outlined" style={viewMode === 'list' ? "font-variation-settings: 'FILL' 1;" : ''}>view_list</span>
				</button>
			</Tooltip>
			<Tooltip text={t('files.gridView')}>
				<button onclick={() => setViewMode('grid')} class="m3-icon-btn" aria-label="Grid view">
					<span class="material-symbols-outlined" style={viewMode === 'grid' ? "font-variation-settings: 'FILL' 1;" : ''}>grid_view</span>
				</button>
			</Tooltip>
			<div class="w-px h-6 bg-outline-variant/30 mx-1"></div>
			{#if selected.size > 0}
				<Tooltip text={t('tags.assignTags')}>
					<button onclick={(e) => openTagPicker([...selected], e.clientX, e.clientY)} class="m3-icon-btn" aria-label={t('tags.assignTags')}>
						<span class="material-symbols-outlined">label</span>
					</button>
				</Tooltip>
				<Tooltip text={t('files.moveSelected', { count: String(selected.size) })}>
					<button onclick={() => openMoveDialog([...selected])} class="m3-icon-btn" aria-label={t('files.moveTo')}>
						<span class="material-symbols-outlined">drive_file_move</span>
					</button>
				</Tooltip>
				<Tooltip text={t('files.deleteSelected', { count: String(selected.size) })}>
					<button onclick={() => deleteFiles([...selected])} class="m3-icon-btn !text-error" aria-label="Delete selected">
						<span class="material-symbols-outlined">delete</span>
					</button>
				</Tooltip>
			{/if}
			<Tooltip text={t('files.newFolder')}>
				<button onclick={openNewFolder} class="m3-icon-btn" aria-label={t('files.newFolder')}>
					<span class="material-symbols-outlined">create_new_folder</span>
				</button>
			</Tooltip>
			<Tooltip text={t('files.uploadBtn')}>
				<button onclick={() => { fileInput?.click(); }} class="m3-icon-btn" aria-label={t('files.uploadBtn')}>
					<span class="material-symbols-outlined">upload_file</span>
				</button>
			</Tooltip>
		</div>
	</div>

	<!-- Filter chips -->
	{#if userTags.length > 0}
		<div class="flex items-center gap-2 overflow-x-auto pb-2 mb-2" style="scrollbar-width: none;">
			<button
				onclick={() => toggleFilter('starred')}
				class="m3-chip !h-7 flex-shrink-0 text-xs {activeFilters.has('starred') ? '!bg-secondary-container !border-primary' : ''}"
			>
				<span class="material-symbols-outlined text-[14px] text-amber-500" style="font-variation-settings: 'FILL' 1;">star</span>
				{t('tags.favorites')}
			</button>
			{#each userTags as tag (tag.id)}
				<button
					onclick={() => toggleFilter(`tag:${tag.id}`)}
					class="m3-chip !h-7 flex-shrink-0 text-xs {activeFilters.has(`tag:${tag.id}`) ? '!bg-secondary-container !border-primary' : ''}"
				>
					<span class="w-2 h-2 rounded-full flex-shrink-0" style="background: {tag.color}"></span>
					{tag.name}
					{#if tag.fileCount > 0}<span class="text-on-surface-variant text-[10px]">{tag.fileCount}</span>{/if}
				</button>
			{/each}
		</div>
	{/if}

	<input bind:this={fileInput} type="file" multiple style="position:fixed;top:-100px;left:-100px;opacity:0;" onchange={(e: Event) => { const input = e.target as HTMLInputElement; uploadFiles(input.files); input.value = ''; }} />

	<!-- Drag overlay -->
	{#if dragging}
		<div class="fixed inset-0 bg-primary/5 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none">
			<div class="bg-surface-container-lowest rounded-3xl shadow-xl px-12 py-10 text-center">
				<span class="material-symbols-outlined text-5xl text-primary mb-3">cloud_upload</span>
				<p class="text-lg font-medium text-on-surface">{t('files.dropHere')}</p>
				<p class="text-sm text-on-surface-variant mt-1">{t('files.dropSubtitle')}</p>
			</div>
		</div>
	{/if}

	<!-- New folder inline -->
	{#if showNewFolder}
		<div class="bg-surface-container-low rounded-2xl p-4 flex items-center gap-3 mb-4">
			<span class="material-symbols-outlined text-on-surface-variant" style="font-variation-settings: 'FILL' 1;">folder</span>
			<input bind:this={folderInput} bind:value={newFolderName} type="text" placeholder={t('files.folderName')}
				class="flex-1 text-sm border-none bg-transparent outline-none placeholder:text-outline"
				onkeydown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') showNewFolder = false; }} />
			<button onclick={createFolder} class="m3-btn m3-btn-text !h-8 !min-w-0 !px-3 text-xs">{t('files.create')}</button>
			<button onclick={() => showNewFolder = false} class="m3-btn m3-btn-text !h-8 !min-w-0 !px-3 text-xs !text-on-surface-variant">{t('confirm.cancel')}</button>
		</div>
	{/if}

	<!-- Empty state -->
	{#if sortedFiles.length === 0 && !showNewFolder}
		<div class="text-center py-24">
			<span class="material-symbols-outlined text-6xl text-outline-variant mb-4">cloud_upload</span>
			<p class="text-lg font-medium text-on-surface">{t('files.emptyTitle')}</p>
			<p class="text-sm text-on-surface-variant mt-1">{t('files.emptySubtitle')}</p>
			<button onclick={() => fileInput?.click()} class="m3-btn m3-btn-filled mt-6">
				<span class="material-symbols-outlined text-[18px]">upload</span> {t('files.uploadBtn')}
			</button>
		</div>

	<!-- Selection bar -->
	{#if selected.size > 0}
		<div class="flex items-center gap-3 px-4 py-2 mb-2 bg-secondary-container/30 rounded-xl" style="animation: m3-fade-in var(--m3-duration-short3) var(--m3-ease-standard-decel);">
			<span class="m3-label-large text-on-secondary-container">{selected.size} selected</span>
			<div class="flex-1"></div>
			<button onclick={() => selected = new Set()} class="m3-btn m3-btn-text !h-8 !min-w-0 !px-3 m3-label-medium">Clear</button>
		</div>
	{/if}

	<!-- LIST VIEW (Google Drive style) -->
	{:else if viewMode === 'list'}
		<table class="w-full text-left table-fixed border-collapse">
			<colgroup>
				<col class="w-12" />
				<col />
				<col class="w-10" />
				<col class="w-32 hidden lg:table-column" />
				<col class="w-20" />
				<col class="w-40" />
			</colgroup>
			<thead class="sticky top-0 bg-surface-container-lowest z-20">
				<tr class="border-b border-outline-variant/30">
					<th class="py-2.5 pl-4">
						<input type="checkbox" checked={allSelected} onchange={toggleAll}
							class="m3-checkbox" />
					</th>
					<th class="py-2.5 cursor-pointer select-none" onclick={() => cycleSortDir('name')}>
						<span class="m3-label-medium text-on-surface-variant inline-flex items-center gap-1 hover:text-on-surface transition-colors">
							{t('files.name')}
							{#if sortKey === 'name'}<span class="material-symbols-outlined text-[16px] text-primary m3-icon-sort {sortDir === 'desc' ? 'desc' : ''}">arrow_upward</span>{/if}
						</span>
					</th>
					<th class="py-2.5"></th>
					<th class="py-2.5 hidden lg:table-cell cursor-pointer select-none" onclick={() => cycleSortDir('updatedAt')}>
						<span class="m3-label-medium text-on-surface-variant inline-flex items-center gap-1 hover:text-on-surface transition-colors">
							{t('files.modified')}
							{#if sortKey === 'updatedAt'}<span class="material-symbols-outlined text-[16px] text-primary m3-icon-sort {sortDir === 'desc' ? 'desc' : ''}">arrow_upward</span>{/if}
						</span>
					</th>
					<th class="py-2.5 cursor-pointer select-none" onclick={() => cycleSortDir('size')}>
						<span class="m3-label-medium text-on-surface-variant inline-flex items-center gap-1 hover:text-on-surface transition-colors">
							{t('files.size')}
							{#if sortKey === 'size'}<span class="material-symbols-outlined text-[16px] text-primary m3-icon-sort {sortDir === 'desc' ? 'desc' : ''}">arrow_upward</span>{/if}
						</span>
					</th>
					<th class="py-2.5"></th>
				</tr>
			</thead>
			<tbody>
				{#each sortedFiles as file, idx (file.id)}
					{@const icon = fileIcon(file.mimeType, file.isFolder ?? false)}
					<tr
						class="group transition-all duration-150 cursor-pointer border-b border-outline-variant/20
							{selected.has(file.id) ? 'bg-secondary-container/25' : 'hover:bg-surface-container-high/50'}
							{dropTargetId === file.id ? '!bg-primary/10 ring-2 ring-primary/40' : ''}"
						ondblclick={() => { if (file.isFolder) openItem(file); else openPreview(file); }}
						oncontextmenu={(e) => onContextMenu(e, file)}
						draggable="true"
						ondragstart={(e) => onRowDragStart(e, file.id)}
						ondragover={file.isFolder ? (e) => onFolderDragOver(e, file.id) : undefined}
						ondragleave={file.isFolder ? () => onFolderDragLeave() : undefined}
						ondrop={file.isFolder ? (e) => onFolderDrop(e, file) : undefined}
						style="animation: m3-stagger-in var(--m3-duration-medium2) var(--m3-ease-emphasized-decel) {Math.min(idx * 25, 150)}ms both;"
					>
						<td class="py-3 pl-4 rounded-l-xl">
							<input type="checkbox" checked={selected.has(file.id)} onchange={() => toggleSelect(file.id)}
								class="m3-checkbox opacity-0 group-hover:opacity-100 transition-opacity {selected.has(file.id) ? '!opacity-100' : ''}" />
						</td>
						<td class="py-3 overflow-hidden max-w-0">
							{#if renamingId === file.id}
								<div class="flex items-center gap-3 overflow-hidden">
									<div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background: {icon.color}12;">
										<span class="material-symbols-outlined text-[22px]" style="color: {icon.color}; {file.isFolder ? "font-variation-settings: 'FILL' 1;" : ''}">{icon.icon}</span>
									</div>
									<input bind:this={renameInput} bind:value={renameValue} type="text"
										class="min-w-0 m3-input !h-9 !text-sm !rounded-lg max-w-xs"
										onkeydown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') renamingId = null; }}
										onblur={submitRename} />
								</div>
							{:else}
								<button class="flex items-center gap-3 w-full text-left cursor-pointer overflow-hidden" onclick={() => { if (file.isFolder) openItem(file); }}>
									<div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-150 group-hover:scale-105" style="background: {icon.color}{file.isFolder ? '15' : '0a'};">
										<span class="material-symbols-outlined text-[22px]" style="color: {icon.color}; {file.isFolder ? "font-variation-settings: 'FILL' 1;" : ''}">{icon.icon}</span>
									</div>
									<div class="min-w-0 overflow-hidden">
										<div class="flex items-center gap-1.5">
											<span class="m3-body-medium font-medium text-on-surface truncate">{file.name}</span>
											{#if file.scanStatus === 'infected'}
												<span class="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full bg-error/10 text-error text-[10px] font-medium flex-shrink-0">
													<span class="material-symbols-outlined text-[12px]">gpp_bad</span>
												</span>
											{:else if file.scanStatus === 'pending' && !file.isFolder}
												<span class="material-symbols-outlined text-[12px] text-on-surface-variant/50 animate-spin flex-shrink-0">progress_activity</span>
											{/if}
											{#if (file as any).tags?.length > 0}
												<div class="flex items-center gap-0.5 flex-shrink-0">
													{#each (file as any).tags.slice(0, 3) as tag}
														<span class="w-2 h-2 rounded-full" style="background: {tag.color};" title={tag.name}></span>
													{/each}
													{#if (file as any).tags.length > 3}
														<span class="text-[9px] text-on-surface-variant">+{(file as any).tags.length - 3}</span>
													{/if}
												</div>
											{/if}
										</div>
										<span class="m3-label-small text-on-surface-variant">
											{#if file.isFolder}{t('files.folder')}{:else}{file.mimeType?.split('/').pop()?.toUpperCase() || 'File'}{#if file.encrypted}&nbsp;&middot;&nbsp;<span class="inline-flex items-center gap-0.5"><span class="material-symbols-outlined text-[12px]">lock</span></span>{/if}{/if}
										</span>
									</div>
								</button>
							{/if}
						</td>
						<td class="py-3 w-8" onclick={(e) => e.stopPropagation()} ondblclick={(e) => e.stopPropagation()}>
							<button
								onclick={() => toggleStar(file.id, !file.starred)}
								class="w-8 h-8 flex items-center justify-center rounded-full cursor-pointer transition-colors
									{file.starred ? 'text-amber-500 hover:text-amber-600' : 'text-on-surface-variant/30 hover:text-amber-400 opacity-0 group-hover:opacity-100'}"
								aria-label={t('files.star')}
							>
								<span class="material-symbols-outlined text-[20px] m3-icon-star {file.starred ? 'active' : ''}" style={file.starred ? "font-variation-settings: 'FILL' 1;" : ''}>star</span>
							</button>
						</td>
						<td class="py-3 hidden lg:table-cell"><span class="m3-body-small text-on-surface-variant">{formatDate(file.updatedAt)}</span></td>
						<td class="py-3"><span class="m3-body-small text-on-surface-variant">{file.size > 0 ? formatFileSize(file.size) : '—'}</span></td>
						<td class="py-3 pr-4 rounded-r-xl text-right">
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 justify-end" ondblclick={(e) => e.stopPropagation()} onclick={(e) => e.stopPropagation()}>
								<Tooltip text={t('files.rename')}>
									<button onclick={() => startRename(file.id, file.name)} class="m3-icon-btn !w-8 !h-8" aria-label={t('files.rename')}>
										<span class="material-symbols-outlined text-lg">edit</span>
									</button>
								</Tooltip>
								<Tooltip text={t('files.moveTo')}>
									<button onclick={() => openMoveDialog([file.id])} class="m3-icon-btn !w-8 !h-8" aria-label="Move to">
										<span class="material-symbols-outlined text-lg">drive_file_move</span>
									</button>
								</Tooltip>
								<Tooltip text={t('files.share')}>
									<button onclick={() => openShare(file.id, file.name, file.isFolder ?? false)} class="m3-icon-btn !w-8 !h-8" aria-label={t('files.share')}>
										<span class="material-symbols-outlined text-lg">share</span>
									</button>
								</Tooltip>
								{#if !file.isFolder}
									<Tooltip text={t('files.download')}>
										<button onclick={() => downloadFile(file.id, file.name, file.encrypted ?? false, file.iv ?? null)} class="m3-icon-btn !w-8 !h-8" aria-label={t('files.download')}>
											<span class="material-symbols-outlined text-lg m3-icon-download">download</span>
										</button>
									</Tooltip>
								{/if}
								<Tooltip text={t('files.delete')}>
									<button onclick={() => deleteFiles([file.id])} class="m3-icon-btn !w-8 !h-8 !text-error" aria-label={t('files.delete')}>
										<span class="material-symbols-outlined text-lg m3-icon-shake">delete</span>
									</button>
								</Tooltip>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

	<!-- GRID VIEW -->
	{:else}
		<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-2">
			{#each sortedFiles as file, idx (file.id)}
				{@const icon = fileIcon(file.mimeType, file.isFolder ?? false)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="group relative bg-surface-container-low rounded-2xl p-5 hover:bg-surface-container-high hover:shadow-[var(--m3-elevation-1)] transition-all cursor-pointer
						{selected.has(file.id) ? 'ring-2 ring-primary bg-secondary-container/20' : ''}
						{dropTargetId === file.id ? '!bg-primary/10 ring-2 ring-primary/40' : ''}"
					ondblclick={() => { if (file.isFolder) openItem(file); else openPreview(file); }}
					oncontextmenu={(e) => onContextMenu(e, file)}
					draggable="true"
					ondragstart={(e) => onRowDragStart(e, file.id)}
					ondragover={file.isFolder ? (e) => onFolderDragOver(e, file.id) : undefined}
					ondragleave={file.isFolder ? () => onFolderDragLeave() : undefined}
					ondrop={file.isFolder ? (e) => onFolderDrop(e, file) : undefined}
					style="animation: m3-stagger-in var(--m3-duration-medium2) var(--m3-ease-emphasized-decel) {Math.min(idx * 30, 200)}ms both;"
				>
					<div class="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity {selected.has(file.id) ? '!opacity-100' : ''}">
						<input type="checkbox" checked={selected.has(file.id)} onchange={() => toggleSelect(file.id)}
							class="m3-checkbox" />
					</div>
					<div class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
						<button onclick={(e) => { e.stopPropagation(); deleteFiles([file.id]); }} class="m3-icon-btn !w-7 !h-7" aria-label="More options">
							<span class="material-symbols-outlined text-[18px]">more_vert</span>
						</button>
					</div>
					<button class="flex flex-col items-center w-full cursor-pointer" onclick={() => { if (file.isFolder) openItem(file); }}>
						<div class="w-12 h-12 rounded-xl flex items-center justify-center mb-2" style="background: {icon.color}10;">
							<span class="material-symbols-outlined text-[28px]" style="color: {icon.color}; {file.isFolder ? "font-variation-settings: 'FILL' 1;" : ''}">{icon.icon}</span>
						</div>
						<p class="m3-body-small font-medium text-on-surface text-center truncate w-full">{file.name}</p>
						<p class="m3-label-small text-on-surface-variant text-center mt-0.5">{file.isFolder ? 'Folder' : formatFileSize(file.size)}</p>
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<TagPicker
	open={tagPicker.open}
	x={tagPicker.x}
	y={tagPicker.y}
	fileIds={tagPicker.fileIds}
	fileTags={allFileTags}
	{userTags}
	onassign={assignTag}
	onremove={removeTag}
	onclose={() => tagPicker = { ...tagPicker, open: false }}
/>
<UploadProgress {uploads} />
<ShareDialog fileId={shareFileId} fileName={shareFileName} isFolder={shareIsFolder} open={shareOpen} onclose={() => shareOpen = false} />
<FilePreview open={previewOpen} fileId={previewFile.id} fileName={previewFile.name} fileSize={previewFile.size} mimeType={previewFile.mimeType} encrypted={previewFile.encrypted} iv={previewFile.iv} onclose={() => previewOpen = false} />
<!-- Encryption Unlock Prompt -->
{#if showUnlockPrompt}
<div class="fixed inset-0 z-50 flex items-center justify-center bg-scrim/40" role="dialog">
	<div class="bg-surface-container-lowest rounded-3xl border border-outline-variant/30 p-8 w-full max-w-sm shadow-xl">
		<div class="flex items-center gap-3 mb-4">
			<span class="material-symbols-outlined text-primary text-2xl">lock</span>
			<h3 class="m3-title-medium text-on-surface">{t('settings.encryption')}</h3>
		</div>
		<p class="m3-body-small text-on-surface-variant mb-4">{t('settings.encryptionSetupDesc')}</p>
		<input type="password" bind:value={unlockPassword} placeholder={t('auth.passwordPlaceholder')}
			class="m3-input mb-3" onkeydown={(e) => { if (e.key === 'Enter') doEncryptionUnlock(); }} />
		{#if unlockError}<div class="text-sm text-error bg-error-container/30 rounded-xl px-4 py-3 mb-3">{unlockError}</div>{/if}
		<div class="flex gap-2">
			<button onclick={doEncryptionUnlock} disabled={!unlockPassword || unlockLoading} class="m3-btn m3-btn-filled flex-1">
				{unlockLoading ? '...' : t('auth.signIn')}
			</button>
			<button onclick={() => { showUnlockPrompt = false; pendingUploadFiles = null; }} class="m3-btn m3-btn-text">{t('settings.cancel')}</button>
		</div>
	</div>
</div>
{/if}

<ConfirmDialog
	open={confirmDelete.open}
	title={t('trash.moveToTrash')}
	message={t('trash.autoDelete')}
	confirmLabel={t('trash.moveToTrash')}
	danger={true}
	onconfirm={executeDelete}
	oncancel={() => confirmDelete = { open: false, ids: [] }}
/>
{#if ctxMenu.open && ctxMenu.file}
	<ContextMenu items={getCtxMenuItems(ctxMenu.file)} x={ctxMenu.x} y={ctxMenu.y} open={ctxMenu.open} onclose={() => ctxMenu = { ...ctxMenu, open: false }} />
{/if}

<!-- Move Dialog -->
{#if moveDialogOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="m3-dialog-backdrop" onclick={(e) => { if (e.target === e.currentTarget) moveDialogOpen = false; }}>
		<div class="m3-dialog max-w-sm">
			<div class="px-6 pt-6 pb-4">
				<h3 class="m3-title-medium text-on-surface mb-1">{t('files.moveTitle')}</h3>
				<p class="m3-body-small text-on-surface-variant">{moveFileIds.length} item{moveFileIds.length !== 1 ? 's' : ''} selected</p>
			</div>
			<div class="px-3 pb-2 max-h-64 overflow-y-auto">
				{#if moveFolders.length === 0}
					<p class="px-3 py-4 m3-body-medium text-on-surface-variant text-center">No folders available</p>
				{:else}
					{#each moveFolders as folder, i (folder.path)}
						{#if i > 0 && folder.path !== '/' && !moveFolders[i-1].path.startsWith('/')}<hr class="m3-divider my-1">{/if}
						<button
							onclick={() => moveToPath(moveFileIds, folder.path)}
							class="m3-list-item w-full text-left rounded-xl"
						>
							<div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 {folder.path === '/' || data.currentPath.split('/').filter(Boolean).length === 1 && i === 0 ? 'bg-primary/10' : 'bg-surface-container-highest'}">
								<span class="material-symbols-outlined text-[20px] {folder.path === '/' || i === 0 && data.currentPath !== '/' ? 'text-primary' : 'text-on-surface-variant'}" style="font-variation-settings: 'FILL' 1;">
									{folder.path === '/' ? 'home' : i === 0 && data.currentPath !== '/' ? 'arrow_upward' : 'folder'}
								</span>
							</div>
							<div class="m3-list-item-content">
								<span class="m3-body-medium text-on-surface">{folder.name}</span>
								<span class="m3-label-small text-on-surface-variant">{folder.path}</span>
							</div>
						</button>
					{/each}
				{/if}
			</div>
			<div class="px-6 py-4 flex justify-end">
				<button onclick={() => moveDialogOpen = false} class="m3-btn m3-btn-text">{t('confirm.cancel')}</button>
			</div>
		</div>
	</div>
{/if}

<!-- Keyboard Shortcuts -->
{#if showShortcuts}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="m3-dialog-backdrop" onclick={(e) => { if (e.target === e.currentTarget) showShortcuts = false; }}>
		<div class="m3-dialog max-w-md">
			<div class="px-6 pt-6 pb-3 flex items-center justify-between">
				<h3 class="m3-title-medium text-on-surface">{t('files.shortcuts')}</h3>
				<button onclick={() => showShortcuts = false} class="m3-icon-btn !w-8 !h-8" aria-label={t('share.close')}>
					<span class="material-symbols-outlined text-lg">close</span>
				</button>
			</div>
			<div class="px-6 pb-6 space-y-4">
				<div>
					<p class="m3-label-medium text-on-surface-variant mb-2">{t('files.shortcutSelection')}</p>
					<div class="space-y-1.5">
						<div class="flex justify-between"><span class="m3-body-medium text-on-surface">{t('files.shortcutSelectAll')}</span><kbd class="m3-label-medium bg-surface-container-high px-2 py-0.5 rounded-md">Ctrl+A</kbd></div>
						<div class="flex justify-between"><span class="m3-body-medium text-on-surface">{t('files.shortcutDeselectAll')}</span><kbd class="m3-label-medium bg-surface-container-high px-2 py-0.5 rounded-md">Esc</kbd></div>
					</div>
				</div>
				<hr class="m3-divider">
				<div>
					<p class="m3-label-medium text-on-surface-variant mb-2">{t('files.shortcutFileOps')}</p>
					<div class="space-y-1.5">
						<div class="flex justify-between"><span class="m3-body-medium text-on-surface">{t('files.shortcutUpload')}</span><kbd class="m3-label-medium bg-surface-container-high px-2 py-0.5 rounded-md">Ctrl+U</kbd></div>
						<div class="flex justify-between"><span class="m3-body-medium text-on-surface">{t('files.shortcutDelete')}</span><kbd class="m3-label-medium bg-surface-container-high px-2 py-0.5 rounded-md">Delete</kbd></div>
						<div class="flex justify-between"><span class="m3-body-medium text-on-surface">{t('files.shortcutOpen')}</span><kbd class="m3-label-medium bg-surface-container-high px-2 py-0.5 rounded-md">Doppelklick</kbd></div>
						<div class="flex justify-between"><span class="m3-body-medium text-on-surface">{t('files.shortcutContextMenu')}</span><kbd class="m3-label-medium bg-surface-container-high px-2 py-0.5 rounded-md">Rechtsklick</kbd></div>
					</div>
				</div>
				<hr class="m3-divider">
				<div>
					<p class="m3-label-medium text-on-surface-variant mb-2">{t('files.shortcutNav')}</p>
					<div class="space-y-1.5">
						<div class="flex justify-between"><span class="m3-body-medium text-on-surface">{t('files.shortcutShowShortcuts')}</span><kbd class="m3-label-medium bg-surface-container-high px-2 py-0.5 rounded-md">?</kbd></div>
						<div class="flex justify-between"><span class="m3-body-medium text-on-surface">{t('files.shortcutCloseDialog')}</span><kbd class="m3-label-medium bg-surface-container-high px-2 py-0.5 rounded-md">Esc</kbd></div>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	table tr td { transition: background-color 0.15s ease-out; }
</style>
