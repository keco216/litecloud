import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files, users } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { saveFile } from '$lib/server/storage';
import { nanoid } from 'nanoid';
import { extractExif, storeMetadata } from '$lib/server/exif';
import { indexFile } from '$lib/server/search';
import { generateAllThumbnails } from '$lib/server/thumbnails';
import { createVersion } from '$lib/server/versions';
import { notifyStorageWarning } from '$lib/server/notifications';
import { queueFileScan } from '$lib/server/scan-queue';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const formData = await request.formData();
	const uploaded = formData.getAll('files') as File[];
	const targetPath = formData.get('path')?.toString() || '/';
	const ivValue = formData.get('iv')?.toString() || null;
	const isEncrypted = formData.get('encrypted')?.toString() === '1';

	if (!uploaded.length) error(400, 'No files provided');

	// Check quota
	const user = db.select().from(users).where(eq(users.id, locals.user.id)).get()!;
	const totalUploadSize = uploaded.reduce((sum, f) => sum + (f instanceof File ? f.size : 0), 0);
	if ((user.storageUsed ?? 0) + totalUploadSize > (user.storageQuota ?? 1073741824)) {
		error(413, 'Storage quota exceeded');
	}

	const results = [];

	for (const file of uploaded) {
		if (!(file instanceof File) || file.size === 0) continue;

		const now = new Date();
		const data = await file.arrayBuffer();
		const mime = file.type || '';

		// Check if file with same name+path already exists → overwrite with versioning
		const existing = db
			.select()
			.from(files)
			.where(
				and(
					eq(files.userId, locals.user.id),
					eq(files.path, targetPath),
					eq(files.name, file.name),
					eq(files.isFolder, false),
					isNull(files.deletedAt)
				)
			)
			.get();

		if (existing) {
			// Create version of the old file before overwriting
			await createVersion(locals.user.id, existing.id, existing.name);

			await saveFile(locals.user.id, existing.id, file.name, data);

			const sizeDiff = file.size - existing.size;
			db.update(files)
				.set({
					size: file.size,
					mimeType: mime || 'application/octet-stream',
					encrypted: isEncrypted,
					iv: ivValue,
					updatedAt: now
				})
				.where(eq(files.id, existing.id))
				.run();

			const current = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, locals.user.id)).get()!;
			db.update(users).set({ storageUsed: (current.used ?? 0) + sizeDiff }).where(eq(users.id, locals.user.id)).run();

			if (mime.startsWith('image/') && !isEncrypted) {
				generateAllThumbnails(locals.user.id, existing.id, file.name).catch(() => {});
			}

			results.push({ id: existing.id, name: file.name, size: file.size, updated: true });
			continue;
		}

		// New file
		const id = nanoid();

		await saveFile(locals.user.id, id, file.name, data);

		db.insert(files)
			.values({
				id,
				userId: locals.user.id,
				name: file.name,
				path: targetPath,
				mimeType: mime || 'application/octet-stream',
				size: file.size,
				isFolder: false,
				encrypted: isEncrypted,
				iv: ivValue,
				createdAt: now,
				updatedAt: now
			})
			.run();

		const current = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, locals.user.id)).get()!;
		db.update(users).set({ storageUsed: (current.used ?? 0) + file.size }).where(eq(users.id, locals.user.id)).run();

		if (mime.startsWith('image/') && !isEncrypted) {
			try {
				const exif = await extractExif(data);
				storeMetadata(id, exif);
			} catch {}
		}

		let extractedText = '';
		if (!isEncrypted && (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml'))) {
			try { extractedText = new TextDecoder().decode(data).slice(0, 10000); } catch {}
		}

		indexFile(id, locals.user.id, file.name, extractedText);

		if (mime.startsWith('image/') && !isEncrypted) {
			generateAllThumbnails(locals.user.id, id, file.name).catch(() => {});
		}

		results.push({ id, name: file.name, size: file.size });
	}

	// Check storage warning after all uploads
	const finalUser = db.select({ used: users.storageUsed, quota: users.storageQuota }).from(users).where(eq(users.id, locals.user.id)).get()!;
	const pct = Math.round(((finalUser.used ?? 0) / (finalUser.quota ?? 1073741824)) * 100);
	if (pct >= 80) notifyStorageWarning(locals.user.id, pct);

	// Queue antivirus scan (background, non-blocking)
	for (const r of results) {
		queueFileScan(r.id, locals.user.id, r.name);
	}

	return json({ files: results });
};
