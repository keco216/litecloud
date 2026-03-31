import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, cleanupTestDb } from '../../tests/setup';
import type Database from 'better-sqlite3';
import type { SearchResult } from './search';

let sqlite: Database.Database;

// Helper functions that replicate the search module logic against the test DB

function indexFile(fileId: string, userId: string, name: string, extractedText?: string): void {
	sqlite
		.prepare('INSERT INTO files_fts (file_id, user_id, name, extracted_text) VALUES (?, ?, ?, ?)')
		.run(fileId, userId, name, extractedText || '');
}

function removeFromIndex(fileId: string): void {
	sqlite.prepare('DELETE FROM files_fts WHERE file_id = ?').run(fileId);
}

function updateIndex(fileId: string, name: string): void {
	sqlite.prepare('UPDATE files_fts SET name = ? WHERE file_id = ?').run(name, fileId);
}

function searchFiles(userId: string, query: string, limit = 50): SearchResult[] {
	const safeQuery = query.replace(/['"]/g, '').trim();
	if (!safeQuery) return [];

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

describe('search module', () => {
	beforeAll(() => {
		const testDb = createTestDb();
		sqlite = testDb.sqlite;
	});

	afterAll(() => {
		sqlite.close();
		cleanupTestDb();
	});

	it('indexFile + searchFiles: index a file, search by name → found', () => {
		indexFile('file-1', 'user-a', 'report.pdf');

		const results = searchFiles('user-a', 'report');
		expect(results.length).toBe(1);
		expect(results[0].fileId).toBe('file-1');
		expect(results[0].name).toBe('report.pdf');
	});

	it('prefix search: "doc" finds "document.pdf"', () => {
		indexFile('file-2', 'user-a', 'document.pdf');

		const results = searchFiles('user-a', 'doc');
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results.some((r) => r.fileId === 'file-2')).toBe(true);
	});

	it('search by extracted text', () => {
		indexFile('file-3', 'user-a', 'notes.txt', 'Meeting minutes from Monday discussion');

		const results = searchFiles('user-a', 'Monday');
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results.some((r) => r.fileId === 'file-3')).toBe(true);
	});

	it('search only finds own user files, not other users', () => {
		indexFile('file-4', 'user-b', 'secret-budget.xlsx');

		const resultsA = searchFiles('user-a', 'secret-budget');
		expect(resultsA.some((r) => r.fileId === 'file-4')).toBe(false);

		const resultsB = searchFiles('user-b', 'secret-budget');
		expect(resultsB.length).toBe(1);
		expect(resultsB[0].fileId).toBe('file-4');
	});

	it('removeFromIndex: after removal, file not found', () => {
		indexFile('file-5', 'user-a', 'temporary.log');
		// Verify it exists first
		expect(searchFiles('user-a', 'temporary').length).toBe(1);

		removeFromIndex('file-5');
		expect(searchFiles('user-a', 'temporary').length).toBe(0);
	});

	it('updateIndex: after update, new name is found', () => {
		indexFile('file-6', 'user-a', 'oldname.txt');
		expect(searchFiles('user-a', 'oldname').length).toBe(1);

		updateIndex('file-6', 'newname.txt');
		expect(searchFiles('user-a', 'oldname').length).toBe(0);
		expect(searchFiles('user-a', 'newname').length).toBe(1);
		expect(searchFiles('user-a', 'newname')[0].fileId).toBe('file-6');
	});

	it('empty query returns empty array', () => {
		const results = searchFiles('user-a', '');
		expect(results).toEqual([]);
	});

	it('whitespace-only query returns empty array', () => {
		const results = searchFiles('user-a', '   ');
		expect(results).toEqual([]);
	});

	it('special characters in query do not crash', () => {
		expect(() => searchFiles('user-a', "it's a \"test\"")).not.toThrow();
		expect(() => searchFiles('user-a', 'file (copy) [2]')).not.toThrow();
		expect(() => searchFiles('user-a', '***')).not.toThrow();
		expect(() => searchFiles('user-a', 'a OR b AND c NOT d')).not.toThrow();
		expect(() => searchFiles('user-a', '<script>alert(1)</script>')).not.toThrow();

		// All should return arrays (possibly empty), never throw
		const result = searchFiles('user-a', '{curly} & braces!');
		expect(Array.isArray(result)).toBe(true);
	});
});
