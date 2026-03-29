import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { saveFile } from '$lib/server/storage';
import { nanoid } from 'nanoid';
import { extractExif, storeMetadata } from '$lib/server/exif';
import { indexFile } from '$lib/server/search';
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

		const id = nanoid();
		const now = new Date();
		const data = await file.arrayBuffer();

		await saveFile(locals.user.id, id, file.name, data);

		db.insert(files)
			.values({
				id,
				userId: locals.user.id,
				name: file.name,
				path: targetPath,
				mimeType: file.type || 'application/octet-stream',
				size: file.size,
				isFolder: false,
				encrypted: isEncrypted,
				iv: ivValue,
				createdAt: now,
				updatedAt: now
			})
			.run();

		// Update storage used
		const current = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, locals.user.id)).get()!;
		db.update(users)
			.set({ storageUsed: (current.used ?? 0) + file.size })
			.where(eq(users.id, locals.user.id))
			.run();

		// Extract EXIF for images (only if not encrypted)
		const mime = file.type || '';
		if (mime.startsWith('image/') && !isEncrypted) {
			try {
				const exif = await extractExif(data);
				storeMetadata(id, exif);
			} catch { /* ignore EXIF errors */ }
		}

		// Extract text for text files (for FTS)
		let extractedText = '';
		if (!isEncrypted && (mime.startsWith('text/') || mime.includes('json') || mime.includes('xml'))) {
			try { extractedText = new TextDecoder().decode(data).slice(0, 10000); } catch {}
		}

		// Index for full-text search
		indexFile(id, locals.user.id, file.name, extractedText);

		results.push({ id, name: file.name, size: file.size });
	}

	return json({ files: results });
};
