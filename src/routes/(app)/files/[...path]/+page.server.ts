import { db } from '$lib/server/db';
import { files } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	// Normalize path — reject traversal attempts
	const segments = (params.path || '').split('/').filter(s => s && s !== '.' && s !== '..');
	const currentPath = '/' + segments.join('/');

	const userFiles = db
		.select()
		.from(files)
		.where(and(eq(files.userId, locals.user!.id), eq(files.path, currentPath)))
		.all();

	return { files: userFiles, currentPath };
};
