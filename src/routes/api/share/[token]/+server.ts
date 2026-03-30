import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { shares, files } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getFileStream } from '$lib/server/storage';
import { Readable } from 'node:stream';
import bcrypt from 'bcrypt';
import archiver from 'archiver';
import { join } from 'node:path';
import type { RequestHandler } from './$types';

const UPLOAD_ROOT = process.env.UPLOAD_DIR || './data/uploads';

function validateShare(share: typeof shares.$inferSelect) {
	if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
		error(410, 'This share link has expired');
	}
	if (share.maxDownloads && (share.downloadCount ?? 0) >= share.maxDownloads) {
		error(410, 'Download limit reached');
	}
}

async function checkPassword(share: typeof shares.$inferSelect, url: URL) {
	if (share.password) {
		const pw = url.searchParams.get('password');
		if (!pw) error(403, 'Password required');
		const valid = await bcrypt.compare(pw, share.password);
		if (!valid) error(403, 'Invalid password');
	}
}

function incrementDownloads(share: typeof shares.$inferSelect) {
	db.update(shares)
		.set({ downloadCount: (share.downloadCount ?? 0) + 1 })
		.where(eq(shares.id, share.id))
		.run();
}

/** Recursively collect all non-folder files under a folder path */
function collectFolderFiles(userId: string, folderPath: string): (typeof files.$inferSelect)[] {
	const allUserFiles = db.select().from(files).where(eq(files.userId, userId)).all();
	return allUserFiles.filter(
		(f) => !f.isFolder && (f.path === folderPath || f.path.startsWith(folderPath + '/'))
	);
}

export const GET: RequestHandler = async ({ params, url }) => {
	const share = db.select().from(shares).where(eq(shares.token, params.token)).get();
	if (!share) error(404, 'Share link not found');

	validateShare(share);
	await checkPassword(share, url);

	const sharedItem = db.select().from(files).where(eq(files.id, share.fileId)).get();
	if (!sharedItem) error(404, 'File not found');

	// Single file download (fileId query param for downloading individual files from shared folder)
	const singleFileId = url.searchParams.get('fileId');
	if (singleFileId && sharedItem.isFolder) {
		const folderFullPath =
			sharedItem.path === '/' ? `/${sharedItem.name}` : `${sharedItem.path}/${sharedItem.name}`;

		const targetFile = db.select().from(files).where(eq(files.id, singleFileId)).get();
		if (!targetFile || targetFile.userId !== sharedItem.userId) error(404, 'File not found');

		// Ensure the file is inside the shared folder
		if (targetFile.path !== folderFullPath && !targetFile.path.startsWith(folderFullPath + '/')) {
			error(403, 'File not in shared folder');
		}

		incrementDownloads(share);

		const isPreview = url.searchParams.has('preview');
		const nodeStream = getFileStream(targetFile.userId, targetFile.id, targetFile.name);
		const webStream = Readable.toWeb(nodeStream) as ReadableStream;
		const disposition = isPreview
			? 'inline'
			: `attachment; filename="${encodeURIComponent(targetFile.name)}"`;

		return new Response(webStream, {
			headers: {
				'Content-Type': targetFile.mimeType || 'application/octet-stream',
				'Content-Disposition': disposition,
				'Content-Length': String(targetFile.size)
			}
		});
	}

	// Folder ZIP download
	if (sharedItem.isFolder) {
		const folderFullPath =
			sharedItem.path === '/' ? `/${sharedItem.name}` : `${sharedItem.path}/${sharedItem.name}`;
		const folderFiles = collectFolderFiles(sharedItem.userId, folderFullPath);

		incrementDownloads(share);

		const archive = archiver('zip', { zlib: { level: 5 } });

		for (const f of folderFiles) {
			// Build relative path within the ZIP
			const relativePath = f.path.slice(folderFullPath.length).replace(/^\//, '');
			const zipPath = relativePath ? `${relativePath}/${f.name}` : f.name;
			const filePath = join(UPLOAD_ROOT, f.userId, f.id, f.name);
			archive.file(filePath, { name: zipPath });
		}

		archive.finalize();

		const nodeStream = archive as unknown as NodeJS.ReadableStream;
		const webStream = Readable.toWeb(Readable.from(nodeStream)) as ReadableStream;

		return new Response(webStream, {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="${encodeURIComponent(sharedItem.name)}.zip"`
			}
		});
	}

	// Regular single file download
	const isPreview = url.searchParams.has('preview');

	if (!isPreview) {
		incrementDownloads(share);
	}

	const nodeStream = getFileStream(sharedItem.userId, sharedItem.id, sharedItem.name);
	const webStream = Readable.toWeb(nodeStream) as ReadableStream;
	const disposition = isPreview
		? 'inline'
		: `attachment; filename="${encodeURIComponent(sharedItem.name)}"`;

	return new Response(webStream, {
		headers: {
			'Content-Type': sharedItem.mimeType || 'application/octet-stream',
			'Content-Disposition': disposition,
			'Content-Length': String(sharedItem.size)
		}
	});
};
