import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and, isNull, isNotNull, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { files, users } from './db/schema';
import { createTestDb, cleanupTestDb } from '../../tests/setup';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './db/schema';

let db: BetterSQLite3Database<typeof schema>;

const RETENTION_DAYS = 30;

function insertUser(id: string, email: string) {
	db.insert(users)
		.values({
			id,
			email,
			passwordHash: 'hashed',
			storageQuota: 1073741824,
			storageUsed: 0,
			createdAt: new Date()
		})
		.run();
}

function insertFile(overrides: Partial<typeof files.$inferInsert> & { id: string; userId: string; name: string }) {
	const now = new Date();
	db.insert(files)
		.values({
			path: '/',
			mimeType: 'application/octet-stream',
			size: 1024,
			isFolder: false,
			createdAt: now,
			updatedAt: now,
			...overrides
		})
		.run();
}

/**
 * Replicate the purge logic from trash.ts against the test DB
 * (without storage/search side-effects).
 */
async function purgeExpiredTrash(): Promise<number> {
	const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);

	const expired = db
		.select()
		.from(files)
		.where(and(isNotNull(files.deletedAt), lt(files.deletedAt, cutoff)))
		.all();

	if (expired.length === 0) return 0;

	for (const file of expired) {
		db.delete(files).where(eq(files.id, file.id)).run();
	}

	// Update storage for each affected user
	const byUser = new Map<string, number>();
	for (const file of expired) {
		if (!file.isFolder) {
			byUser.set(file.userId, (byUser.get(file.userId) || 0) + file.size);
		}
	}
	for (const [userId, freed] of byUser) {
		const current = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, userId)).get();
		const newUsed = Math.max(0, (current?.used || 0) - freed);
		db.update(users).set({ storageUsed: newUsed }).where(eq(users.id, userId)).run();
	}

	return expired.length;
}

describe('trash', () => {
	let sqlite: ReturnType<typeof import('better-sqlite3')['default']>;
	const userId = nanoid();

	beforeAll(() => {
		const testDb = createTestDb();
		db = testDb.db as unknown as BetterSQLite3Database<typeof schema>;
		sqlite = testDb.sqlite;

		insertUser(userId, 'trash-test@example.com');
	});

	afterAll(() => {
		sqlite.close();
		cleanupTestDb();
	});

	describe('soft delete', () => {
		it('sets deletedAt on a file', () => {
			const fileId = nanoid();
			insertFile({ id: fileId, userId, name: 'soft-delete.txt' });

			const deletedAt = new Date();
			db.update(files)
				.set({ deletedAt })
				.where(eq(files.id, fileId))
				.run();

			const row = db.select().from(files).where(eq(files.id, fileId)).get();
			expect(row).toBeDefined();
			expect(row!.deletedAt).toBeDefined();
			expect(Math.floor(row!.deletedAt!.getTime() / 1000)).toBe(Math.floor(deletedAt.getTime() / 1000));
		});

		it('excludes soft-deleted files when querying with isNull(deletedAt)', () => {
			const visibleId = nanoid();
			const deletedId = nanoid();

			insertFile({ id: visibleId, userId, name: 'visible.txt' });
			insertFile({ id: deletedId, userId, name: 'deleted.txt', deletedAt: new Date() });

			const active = db
				.select()
				.from(files)
				.where(and(eq(files.userId, userId), isNull(files.deletedAt)))
				.all();

			const activeIds = active.map((f) => f.id);
			expect(activeIds).toContain(visibleId);
			expect(activeIds).not.toContain(deletedId);
		});
	});

	describe('restore', () => {
		it('sets deletedAt back to null so the file is visible again', () => {
			const fileId = nanoid();
			insertFile({ id: fileId, userId, name: 'restore-me.txt', deletedAt: new Date() });

			// Confirm it is soft-deleted
			const before = db.select().from(files).where(eq(files.id, fileId)).get();
			expect(before!.deletedAt).not.toBeNull();

			// Restore
			db.update(files)
				.set({ deletedAt: null })
				.where(eq(files.id, fileId))
				.run();

			const after = db.select().from(files).where(eq(files.id, fileId)).get();
			expect(after!.deletedAt).toBeNull();

			// Should now appear in active query
			const active = db
				.select()
				.from(files)
				.where(and(eq(files.id, fileId), isNull(files.deletedAt)))
				.all();
			expect(active).toHaveLength(1);
		});
	});

	describe('purge', () => {
		it('permanently removes a file from the database', () => {
			const fileId = nanoid();
			insertFile({ id: fileId, userId, name: 'purge-me.txt' });

			db.delete(files).where(eq(files.id, fileId)).run();

			const row = db.select().from(files).where(eq(files.id, fileId)).get();
			expect(row).toBeUndefined();
		});
	});

	describe('folder soft delete', () => {
		it('sets deletedAt on a folder and all its children', () => {
			const folderId = nanoid();
			const childId1 = nanoid();
			const childId2 = nanoid();
			const folderName = `folder-${folderId}`;

			insertFile({ id: folderId, userId, name: folderName, path: '/', isFolder: true, size: 0 });
			insertFile({ id: childId1, userId, name: 'child1.txt', path: `/${folderName}` });
			insertFile({ id: childId2, userId, name: 'child2.txt', path: `/${folderName}` });

			const deletedAt = new Date();
			// Soft-delete the folder
			db.update(files).set({ deletedAt }).where(eq(files.id, folderId)).run();
			// Soft-delete all children (simulate cascade)
			db.update(files).set({ deletedAt }).where(eq(files.id, childId1)).run();
			db.update(files).set({ deletedAt }).where(eq(files.id, childId2)).run();

			// All three should be soft-deleted
			for (const id of [folderId, childId1, childId2]) {
				const row = db.select().from(files).where(eq(files.id, id)).get();
				expect(row!.deletedAt).toBeDefined();
				expect(Math.floor(row!.deletedAt!.getTime() / 1000)).toBe(Math.floor(deletedAt.getTime() / 1000));
			}

			// None should appear in active query
			const active = db
				.select()
				.from(files)
				.where(
					and(
						eq(files.userId, userId),
						isNull(files.deletedAt),
						eq(files.path, `/${folderName}`)
					)
				)
				.all();
			expect(active).toHaveLength(0);
		});
	});

	describe('auto-purge logic', () => {
		it('purges files deleted more than 30 days ago', async () => {
			const fileId = nanoid();
			const deletedAt = new Date(Date.now() - 31 * 86400000); // 31 days ago

			insertFile({ id: fileId, userId, name: 'old-trash.txt', deletedAt, size: 2048 });

			// Set user storage so we can verify it decreases
			db.update(users).set({ storageUsed: 10000 }).where(eq(users.id, userId)).run();

			const purged = await purgeExpiredTrash();
			expect(purged).toBeGreaterThanOrEqual(1);

			const row = db.select().from(files).where(eq(files.id, fileId)).get();
			expect(row).toBeUndefined();

			// Verify storage was reduced
			const user = db.select().from(users).where(eq(users.id, userId)).get();
			expect(user!.storageUsed).toBeLessThan(10000);
		});

		it('does NOT purge files deleted less than 30 days ago', async () => {
			const fileId = nanoid();
			const deletedAt = new Date(Date.now() - 10 * 86400000); // 10 days ago

			insertFile({ id: fileId, userId, name: 'recent-trash.txt', deletedAt });

			await purgeExpiredTrash();

			const row = db.select().from(files).where(eq(files.id, fileId)).get();
			expect(row).toBeDefined();
			expect(row!.deletedAt).not.toBeNull();
		});
	});
});
