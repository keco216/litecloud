import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files, users } from '$lib/server/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401);

	const userId = locals.user.id;
	const user = db
		.select({ storageUsed: users.storageUsed, storageQuota: users.storageQuota })
		.from(users)
		.where(eq(users.id, userId))
		.get()!;

	const allFiles = db
		.select({
			id: files.id,
			name: files.name,
			size: files.size,
			mimeType: files.mimeType,
			path: files.path,
			encrypted: files.encrypted,
			createdAt: files.createdAt
		})
		.from(files)
		.where(and(eq(files.userId, userId), eq(files.isFolder, false), isNull(files.deletedAt)))
		.all();

	// Breakdown by category
	const categories: Record<string, { count: number; size: number; color: string; icon: string }> = {
		images: { count: 0, size: 0, color: '#14b8a6', icon: 'image' },
		videos: { count: 0, size: 0, color: '#ec4899', icon: 'movie' },
		audio: { count: 0, size: 0, color: '#f97316', icon: 'music_note' },
		documents: { count: 0, size: 0, color: '#4285f4', icon: 'description' },
		pdfs: { count: 0, size: 0, color: '#ea4335', icon: 'picture_as_pdf' },
		archives: { count: 0, size: 0, color: '#f59e0b', icon: 'folder_zip' },
		code: { count: 0, size: 0, color: '#10b981', icon: 'code' },
		other: { count: 0, size: 0, color: '#9ca3af', icon: 'description' }
	};

	for (const f of allFiles) {
		const mime = f.mimeType || '';
		let cat = 'other';
		if (mime.startsWith('image/')) cat = 'images';
		else if (mime.startsWith('video/')) cat = 'videos';
		else if (mime.startsWith('audio/')) cat = 'audio';
		else if (mime.includes('pdf')) cat = 'pdfs';
		else if (mime.includes('document') || mime.includes('msword') || mime.includes('opendocument')) cat = 'documents';
		else if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('7z')) cat = 'archives';
		else if (mime.startsWith('text/') || mime.includes('json') || mime.includes('javascript') || mime.includes('xml')) cat = 'code';
		categories[cat].count++;
		categories[cat].size += f.size;
	}

	// Top 10 largest files
	const largestFiles = [...allFiles]
		.sort((a, b) => b.size - a.size)
		.slice(0, 10)
		.map((f) => ({ id: f.id, name: f.name, size: f.size, mimeType: f.mimeType, path: f.path }));

	// Monthly uploads (last 12 months)
	const monthlyData: Record<string, { uploads: number; bytes: number }> = {};
	const now = new Date();
	for (let i = 11; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		monthlyData[key] = { uploads: 0, bytes: 0 };
	}
	for (const f of allFiles) {
		const d = new Date(f.createdAt);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
		if (monthlyData[key]) {
			monthlyData[key].uploads++;
			monthlyData[key].bytes += f.size;
		}
	}

	// Top 5 folders
	const folderSizes: Record<string, number> = {};
	for (const f of allFiles) {
		const folder = f.path === '/' ? 'Root' : f.path.split('/').filter(Boolean)[0] || 'Root';
		folderSizes[folder] = (folderSizes[folder] || 0) + f.size;
	}
	const topFolders = Object.entries(folderSizes)
		.sort(([, a], [, b]) => b - a)
		.slice(0, 5)
		.map(([name, size]) => ({ name, size }));

	// Encryption stats
	const encryptedCount = allFiles.filter((f) => f.encrypted).length;
	const encryptedSize = allFiles.filter((f) => f.encrypted).reduce((s, f) => s + f.size, 0);

	return json({
		total: { used: user.storageUsed ?? 0, quota: user.storageQuota ?? 1073741824, fileCount: allFiles.length },
		categories,
		largestFiles,
		monthlyData,
		topFolders,
		encryption: {
			encryptedCount,
			encryptedSize,
			unencryptedCount: allFiles.length - encryptedCount,
			unencryptedSize: Math.max(0, (user.storageUsed ?? 0) - encryptedSize)
		}
	});
};
