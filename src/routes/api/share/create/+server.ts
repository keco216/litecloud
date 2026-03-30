import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { files, shares } from '$lib/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	if (!locals.user) error(401, 'Unauthorized');

	const body = await request.json();
	const { fileId, password, expiresIn, maxDownloads } = body as {
		fileId: string;
		password?: string;
		expiresIn?: number; // hours
		maxDownloads?: number;
	};

	if (!fileId) error(400, 'fileId is required');

	const file = db
		.select()
		.from(files)
		.where(and(eq(files.id, fileId), eq(files.userId, locals.user.id)))
		.get();

	if (!file) error(404, 'File not found');

	const id = nanoid();
	const token = nanoid(21);
	const now = new Date();

	let passwordHash: string | null = null;
	if (password?.trim()) {
		passwordHash = await bcrypt.hash(password, 10);
	}

	let expiresAt: Date | null = null;
	if (expiresIn && expiresIn > 0) {
		expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);
	}

	db.insert(shares)
		.values({
			id,
			token,
			fileId,
			userId: locals.user.id,
			password: passwordHash,
			expiresAt,
			maxDownloads: maxDownloads && maxDownloads > 0 ? maxDownloads : null,
			createdAt: now
		})
		.run();

	const origin = url.origin;
	return json({ token, url: `${origin}/share/${token}`, id });
};
