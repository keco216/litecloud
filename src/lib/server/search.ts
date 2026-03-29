import { sqlite } from './db';

export function indexFile(fileId: string, userId: string, name: string, extractedText?: string): void {
	sqlite
		.prepare('INSERT INTO files_fts (file_id, user_id, name, extracted_text) VALUES (?, ?, ?, ?)')
		.run(fileId, userId, name, extractedText || '');
}

export function removeFromIndex(fileId: string): void {
	sqlite
		.prepare('DELETE FROM files_fts WHERE file_id = ?')
		.run(fileId);
}

export function updateIndex(fileId: string, name: string): void {
	sqlite
		.prepare('UPDATE files_fts SET name = ? WHERE file_id = ?')
		.run(name, fileId);
}

export interface SearchResult {
	fileId: string;
	name: string;
	snippet: string;
	rank: number;
}

export function searchFiles(userId: string, query: string, limit = 50): SearchResult[] {
	// Sanitize query for FTS5
	const safeQuery = query.replace(/['"]/g, '').trim();
	if (!safeQuery) return [];

	// Search with prefix matching for partial words
	const ftsQuery = safeQuery
		.split(/\s+/)
		.map((w) => `"${w}"*`)
		.join(' ');

	try {
		const rows = sqlite
			.prepare(
				`SELECT file_id, name,
					snippet(files_fts, 2, '<mark>', '</mark>', '...', 32) as snippet,
					rank
				 FROM files_fts
				 WHERE files_fts MATCH ? AND user_id = ?
				 ORDER BY rank
				 LIMIT ?`
			)
			.all(ftsQuery, userId, limit) as any[];

		return rows.map((r) => ({
			fileId: r.file_id,
			name: r.name,
			snippet: r.snippet,
			rank: r.rank
		}));
	} catch {
		return [];
	}
}
