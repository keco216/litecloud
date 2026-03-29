import { error, json } from '@sveltejs/kit';
import { searchFiles } from '$lib/server/search';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const query = url.searchParams.get('q') || '';
	if (!query.trim()) return json({ results: [] });

	const results = searchFiles(locals.user.id, query);
	return json({ results });
};
