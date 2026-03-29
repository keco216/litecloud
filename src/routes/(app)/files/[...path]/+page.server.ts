import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const segments = (params.path || '').split('/').filter(s => s && s !== '.' && s !== '..');
	const currentPath = '/' + segments.join('/');

	const userFiles = db
		.select()
		.from(files)
		.where(and(eq(files.userId, locals.user!.id), eq(files.path, currentPath)))
		.all();

	const folders = userFiles.filter(f => f.isFolder);

	if (folders.length === 0) return { files: userFiles, currentPath };

	// Get all non-folder files for this user in one query
	const allFiles = db
		.select({ size: files.size, path: files.path })
		.from(files)
		.where(and(eq(files.userId, locals.user!.id), eq(files.isFolder, false)))
		.all();

	// Calculate each folder's total size
	const enriched = userFiles.map(f => {
		if (!f.isFolder) return f;
		const folderPath = currentPath === '/' ? '/' + f.name : currentPath + '/' + f.name;
		const folderSize = allFiles
			.filter(c => c.path === folderPath || c.path.startsWith(folderPath + '/'))
			.reduce((sum, c) => sum + c.size, 0);
		return { ...f, size: folderSize };
	});

	return { files: enriched, currentPath };
};
