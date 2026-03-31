import { db } from './db';
import { fileVersions, files, users } from './db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { mkdir, rm, copyFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || './data/uploads';
const MAX_VERSIONS = 5;

export async function createVersion(userId: string, fileId: string, fileName: string): Promise<void> {
	const existing = db
		.select()
		.from(fileVersions)
		.where(eq(fileVersions.fileId, fileId))
		.orderBy(desc(fileVersions.versionNumber))
		.all();

	const nextVersion = existing.length > 0 ? existing[0].versionNumber + 1 : 1;
	const versionId = nanoid();

	const currentPath = join(UPLOAD_ROOT, userId, fileId, fileName);
	const versionsDir = join(UPLOAD_ROOT, userId, fileId, '.versions');
	await mkdir(versionsDir, { recursive: true });
	const versionPath = join(versionsDir, `v${nextVersion}_${fileName}`);

	try {
		const fileStat = await stat(currentPath);
		await copyFile(currentPath, versionPath);

		db.insert(fileVersions)
			.values({ id: versionId, fileId, versionNumber: nextVersion, size: fileStat.size, createdAt: new Date() })
			.run();

		// Storage: version takes space too
		const user = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, userId)).get();
		if (user) {
			db.update(users)
				.set({ storageUsed: (user.used ?? 0) + fileStat.size })
				.where(eq(users.id, userId))
				.run();
		}

		await pruneVersions(userId, fileId, fileName);
	} catch (err) {
		console.error('[versions] Failed to create version:', err);
	}
}

async function pruneVersions(userId: string, fileId: string, fileName: string): Promise<void> {
	const versions = db
		.select()
		.from(fileVersions)
		.where(eq(fileVersions.fileId, fileId))
		.orderBy(desc(fileVersions.versionNumber))
		.all();

	if (versions.length <= MAX_VERSIONS) return;

	const toDelete = versions.slice(MAX_VERSIONS);
	const versionsDir = join(UPLOAD_ROOT, userId, fileId, '.versions');

	for (const v of toDelete) {
		const vPath = join(versionsDir, `v${v.versionNumber}_${fileName}`);
		try { await rm(vPath, { force: true }); } catch {}

		const user = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, userId)).get();
		if (user) {
			db.update(users)
				.set({ storageUsed: Math.max(0, (user.used ?? 0) - v.size) })
				.where(eq(users.id, userId))
				.run();
		}

		db.delete(fileVersions).where(eq(fileVersions.id, v.id)).run();
	}
}

export function listVersions(fileId: string) {
	return db
		.select()
		.from(fileVersions)
		.where(eq(fileVersions.fileId, fileId))
		.orderBy(desc(fileVersions.versionNumber))
		.all();
}

export async function restoreVersion(
	userId: string,
	fileId: string,
	versionId: string,
	fileName: string
): Promise<boolean> {
	const version = db
		.select()
		.from(fileVersions)
		.where(and(eq(fileVersions.id, versionId), eq(fileVersions.fileId, fileId)))
		.get();

	if (!version) return false;

	const currentPath = join(UPLOAD_ROOT, userId, fileId, fileName);
	const versionPath = join(UPLOAD_ROOT, userId, fileId, '.versions', `v${version.versionNumber}_${fileName}`);

	// Save current as new version first
	await createVersion(userId, fileId, fileName);

	// Restore the old version
	await copyFile(versionPath, currentPath);

	const fileStat = await stat(currentPath);
	db.update(files).set({ size: fileStat.size, updatedAt: new Date() }).where(eq(files.id, fileId)).run();

	return true;
}

export async function deleteAllVersions(userId: string, fileId: string): Promise<number> {
	const versions = db.select().from(fileVersions).where(eq(fileVersions.fileId, fileId)).all();
	let freedBytes = 0;

	for (const v of versions) {
		freedBytes += v.size;
		db.delete(fileVersions).where(eq(fileVersions.id, v.id)).run();
	}

	const versionsDir = join(UPLOAD_ROOT, userId, fileId, '.versions');
	try { await rm(versionsDir, { recursive: true, force: true }); } catch {}

	return freedBytes;
}
