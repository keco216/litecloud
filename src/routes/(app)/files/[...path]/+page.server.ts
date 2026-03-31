import { db } from '$lib/server/db';
import { files, fileTags, tags } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const segments = (params.path || '').split('/').filter(s => s && s !== '.' && s !== '..');
	const currentPath = '/' + segments.join('/');

	const userFiles = db
		.select()
		.from(files)
		.where(and(eq(files.userId, locals.user!.id), eq(files.path, currentPath), isNull(files.deletedAt)))
		.all();

	// Load tags for all files in this directory
	const fileIds = userFiles.map((f) => f.id);
	const allFileTags =
		fileIds.length > 0
			? db
					.select({ fileId: fileTags.fileId, tagId: tags.id, tagName: tags.name, tagColor: tags.color })
					.from(fileTags)
					.innerJoin(tags, eq(fileTags.tagId, tags.id))
					.all()
					.filter((ft) => fileIds.includes(ft.fileId))
			: [];

	// Group tags by fileId
	const tagsByFile = new Map<string, { id: string; name: string; color: string }[]>();
	for (const ft of allFileTags) {
		if (!tagsByFile.has(ft.fileId)) tagsByFile.set(ft.fileId, []);
		tagsByFile.get(ft.fileId)!.push({ id: ft.tagId, name: ft.tagName, color: ft.tagColor });
	}

	const folders = userFiles.filter((f) => f.isFolder);

	const allNonFolderFiles =
		folders.length > 0
			? db
					.select({ size: files.size, path: files.path })
					.from(files)
					.where(and(eq(files.userId, locals.user!.id), eq(files.isFolder, false), isNull(files.deletedAt)))
					.all()
			: [];

	const enriched = userFiles.map((f) => {
		const fileTags = tagsByFile.get(f.id) || [];
		if (!f.isFolder) return { ...f, tags: fileTags };
		const folderPath = currentPath === '/' ? '/' + f.name : currentPath + '/' + f.name;
		const folderSize = allNonFolderFiles
			.filter((c) => c.path === folderPath || c.path.startsWith(folderPath + '/'))
			.reduce((sum, c) => sum + c.size, 0);
		return { ...f, size: folderSize, tags: fileTags };
	});

	return { files: enriched, currentPath };
};
