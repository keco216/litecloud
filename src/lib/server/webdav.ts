/**
 * WebDAV handler for LiteCloud.
 * Mounts under /dav/ — supports Finder, Explorer, Nautilus.
 * Uses Basic Auth (email:password).
 */

import { db } from './db';
import { users, files, shares, fileMetadata, fileTags } from './db/schema';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { removeFromIndex } from './search';
import { verifyCredentials } from './auth';
import { saveFile, getFileStream, deleteFile as removeFileFromDisk } from './storage';
import { deleteThumbnails } from './thumbnails';
import { apiLimiter } from './ratelimit';
import { createVersion, deleteAllVersions } from './versions';
import { queueFileScan } from './scan-queue';
import { Readable } from 'node:stream';
import { nanoid } from 'nanoid';

const DAV_PREFIX = '/dav';

interface DavUser {
	id: string;
	email: string;
}

async function authenticate(request: Request): Promise<DavUser | null> {
	const auth = request.headers.get('authorization');
	if (!auth?.startsWith('Basic ')) return null;

	const decoded = atob(auth.slice(6));
	const colon = decoded.indexOf(':');
	if (colon === -1) return null;

	const email = decoded.slice(0, colon);
	const password = decoded.slice(colon + 1);

	return verifyCredentials(email, password);
}

function davPath(url: URL): string {
	let p = decodeURIComponent(url.pathname.slice(DAV_PREFIX.length));
	// SECURITY: normalize and reject path traversal
	const segments = p.split('/').filter(s => s && s !== '.');
	if (segments.some(s => s === '..')) {
		throw new Error('Path traversal rejected');
	}
	p = '/' + segments.join('/');
	if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
	return p;
}

function parentPath(p: string): string {
	const i = p.lastIndexOf('/');
	return i <= 0 ? '/' : p.slice(0, i);
}

function fileName(p: string): string {
	return p.slice(p.lastIndexOf('/') + 1);
}

function xmlEscape(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatRFC1123(d: Date): string {
	return d.toUTCString();
}

function multistatus(entries: string[]): string {
	return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
${entries.join('\n')}
</D:multistatus>`;
}

function propfindResponse(href: string, isCollection: boolean, size: number, modified: Date, mimeType?: string | null): string {
	const date = formatRFC1123(modified);
	return `<D:response>
<D:href>${xmlEscape(href)}</D:href>
<D:propstat>
<D:prop>
<D:resourcetype>${isCollection ? '<D:collection/>' : ''}</D:resourcetype>
<D:getcontentlength>${size}</D:getcontentlength>
<D:getlastmodified>${date}</D:getlastmodified>
${mimeType && !isCollection ? `<D:getcontenttype>${xmlEscape(mimeType)}</D:getcontenttype>` : ''}
<D:displayname>${xmlEscape(href.split('/').pop() || '')}</D:displayname>
</D:prop>
<D:status>HTTP/1.1 200 OK</D:status>
</D:propstat>
</D:response>`;
}

const CORS_HEADERS: Record<string, string> = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, PROPFIND, MOVE, COPY',
	'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, Destination, Overwrite',
	'Access-Control-Expose-Headers': 'DAV, Allow',
	'Access-Control-Max-Age': '86400'
};

function withCors(res: Response): Response {
	for (const [k, v] of Object.entries(CORS_HEADERS)) {
		res.headers.set(k, v);
	}
	return res;
}

function unauthorized(): Response {
	return withCors(new Response('Unauthorized', {
		status: 401,
		headers: { 'WWW-Authenticate': 'Basic realm="LiteCloud"' }
	}));
}

export function isDavRequest(url: URL): boolean {
	return url.pathname.startsWith(DAV_PREFIX);
}

export async function handleDav(request: Request): Promise<Response> {
	const method = request.method.toUpperCase();
	const url = new URL(request.url);

	// OPTIONS / CORS preflight — always respond (needed for WebDAV + cross-origin)
	if (method === 'OPTIONS') {
		return new Response(null, {
			status: 204,
			headers: {
				...CORS_HEADERS,
				Allow: 'OPTIONS, GET, HEAD, PUT, DELETE, MKCOL, PROPFIND, MOVE, COPY',
				DAV: '1, 2',
				'MS-Author-Via': 'DAV'
			}
		});
	}

	const user = await authenticate(request);
	if (!user) return unauthorized();

	const davLimit = apiLimiter.check(`dav:${user.id}`);
	if (!davLimit.allowed) {
		return withCors(new Response('Rate limit exceeded', {
			status: 429,
			headers: { 'Retry-After': String(Math.ceil(davLimit.retryAfterMs / 1000)) }
		}));
	}

	let path: string;
	try {
		path = davPath(url);
	} catch {
		return withCors(new Response('Invalid path', { status: 400 }));
	}

	let res: Response;
	switch (method) {
		case 'PROPFIND':
			res = await handlePropfind(user, path, request); break;
		case 'GET':
		case 'HEAD':
			res = await handleGet(user, path, method === 'HEAD'); break;
		case 'PUT':
			res = await handlePut(user, path, request); break;
		case 'DELETE':
			res = await handleDelete(user, path); break;
		case 'MKCOL':
			res = await handleMkcol(user, path); break;
		case 'MOVE':
			res = await handleMove(user, path, request); break;
		case 'COPY':
			res = await handleCopy(user, path, request); break;
		default:
			res = new Response('Method not allowed', { status: 405 });
	}
	return withCors(res);
}

async function handlePropfind(user: DavUser, path: string, request: Request): Promise<Response> {
	const depthHeader = request.headers.get('depth') || '1';
	const depth = depthHeader === '0' ? 0 : 1;

	const entries: string[] = [];

	if (path === '/') {
		// Root collection
		entries.push(propfindResponse(DAV_PREFIX + '/', true, 0, new Date()));

		if (depth > 0) {
			const items = db.select().from(files).where(and(eq(files.userId, user.id), eq(files.path, '/'), isNull(files.deletedAt))).all();
			for (const item of items) {
				const href = `${DAV_PREFIX}/${encodeURIComponent(item.name)}${item.isFolder ? '/' : ''}`;
				entries.push(propfindResponse(href, !!item.isFolder, item.size, new Date(item.updatedAt), item.mimeType));
			}
		}
	} else {
		// Find the resource
		const name = fileName(path);
		const parent = parentPath(path);

		const item = db
			.select()
			.from(files)
			.where(and(eq(files.userId, user.id), eq(files.path, parent), eq(files.name, name), isNull(files.deletedAt)))
			.get();

		if (!item) {
			return new Response('Not Found', { status: 404 });
		}

		const href = `${DAV_PREFIX}${path}${item.isFolder ? '/' : ''}`;
		entries.push(propfindResponse(href, !!item.isFolder, item.size, new Date(item.updatedAt), item.mimeType));

		if (item.isFolder && depth > 0) {
			const folderPath = parent === '/' ? `/${name}` : `${parent}/${name}`;
			const children = db.select().from(files).where(and(eq(files.userId, user.id), eq(files.path, folderPath), isNull(files.deletedAt))).all();
			for (const child of children) {
				const childHref = `${DAV_PREFIX}${folderPath}/${encodeURIComponent(child.name)}${child.isFolder ? '/' : ''}`;
				entries.push(propfindResponse(childHref, !!child.isFolder, child.size, new Date(child.updatedAt), child.mimeType));
			}
		}
	}

	return new Response(multistatus(entries), {
		status: 207,
		headers: { 'Content-Type': 'application/xml; charset=utf-8' }
	});
}

async function handleGet(user: DavUser, path: string, headOnly: boolean): Promise<Response> {
	if (path === '/') {
		return new Response('Collection', { status: 200 });
	}

	const name = fileName(path);
	const parent = parentPath(path);

	const item = db
		.select()
		.from(files)
		.where(and(eq(files.userId, user.id), eq(files.path, parent), eq(files.name, name), isNull(files.deletedAt)))
		.get();

	if (!item || item.isFolder) return new Response('Not Found', { status: 404 });

	if (headOnly) {
		return new Response(null, {
			headers: {
				'Content-Type': item.mimeType || 'application/octet-stream',
				'Content-Length': String(item.size)
			}
		});
	}

	const stream = getFileStream(user.id, item.id, item.name);
	const webStream = Readable.toWeb(stream) as ReadableStream;

	return new Response(webStream, {
		headers: {
			'Content-Type': item.mimeType || 'application/octet-stream',
			'Content-Length': String(item.size),
			'Content-Disposition': `attachment; filename="${encodeURIComponent(item.name)}"`
		}
	});
}

async function handlePut(user: DavUser, path: string, request: Request): Promise<Response> {
	const name = fileName(path);
	const parent = parentPath(path);

	const body = await request.arrayBuffer();

	// Check if file already exists
	const existing = db
		.select()
		.from(files)
		.where(and(eq(files.userId, user.id), eq(files.path, parent), eq(files.name, name), isNull(files.deletedAt)))
		.get();

	const now = new Date();

	if (existing && !existing.isFolder) {
		// Create version before overwriting
		await createVersion(user.id, existing.id, name);
		await saveFile(user.id, existing.id, name, body);
		const sizeDiff = body.byteLength - existing.size;
		db.update(files).set({ size: body.byteLength, updatedAt: now }).where(eq(files.id, existing.id)).run();

		const u = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, user.id)).get()!;
		db.update(users).set({ storageUsed: (u.used ?? 0) + sizeDiff }).where(eq(users.id, user.id)).run();

		queueFileScan(existing.id, user.id, name);
		return new Response(null, { status: 204 });
	}

	// Create new file
	const id = nanoid();
	const mimeType = request.headers.get('content-type') || 'application/octet-stream';

	await saveFile(user.id, id, name, body);

	db.insert(files).values({
		id, userId: user.id, name, path: parent,
		mimeType, size: body.byteLength, isFolder: false,
		createdAt: now, updatedAt: now
	}).run();

	const u = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, user.id)).get()!;
	db.update(users).set({ storageUsed: (u.used ?? 0) + body.byteLength }).where(eq(users.id, user.id)).run();

	queueFileScan(id, user.id, name);
	return new Response(null, { status: 201 });
}

async function handleDelete(user: DavUser, path: string): Promise<Response> {
	const name = fileName(path);
	const parent = parentPath(path);

	const item = db
		.select()
		.from(files)
		.where(and(eq(files.userId, user.id), eq(files.path, parent), eq(files.name, name), isNull(files.deletedAt)))
		.get();

	if (!item) return new Response('Not Found', { status: 404 });

	// Collect all file IDs to delete (including folder contents)
	const idsToDelete: string[] = [item.id];

	if (item.isFolder) {
		const folderPath = parent === '/' ? `/${name}` : `${parent}/${name}`;
		const all = db.select().from(files).where(and(eq(files.userId, user.id), isNull(files.deletedAt))).all();
		for (const child of all.filter(f => f.path === folderPath || f.path.startsWith(folderPath + '/'))) {
			idsToDelete.push(child.id);
		}
	}

	// FK cleanup BEFORE deleting files (shares, metadata, search index)
	db.delete(shares).where(inArray(shares.fileId, idsToDelete)).run();
	db.delete(fileTags).where(inArray(fileTags.fileId, idsToDelete)).run();
	db.delete(fileMetadata).where(inArray(fileMetadata.fileId, idsToDelete)).run();
	for (const id of idsToDelete) removeFromIndex(id);

	let freed = 0;
	for (const id of idsToDelete) {
		const f = db.select().from(files).where(eq(files.id, id)).get();
		if (f && !f.isFolder) {
			await removeFileFromDisk(user.id, f.id);
			await deleteThumbnails(user.id, f.id);
			const versionBytes = await deleteAllVersions(user.id, f.id);
			freed += f.size + versionBytes;
		}
		db.delete(files).where(eq(files.id, id)).run();
	}

	if (freed > 0) {
		const u = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, user.id)).get()!;
		db.update(users).set({ storageUsed: Math.max(0, (u.used ?? 0) - freed) }).where(eq(users.id, user.id)).run();
	}

	return new Response(null, { status: 204 });
}

async function handleMkcol(user: DavUser, path: string): Promise<Response> {
	const name = fileName(path);
	const parent = parentPath(path);

	const existing = db
		.select()
		.from(files)
		.where(and(eq(files.userId, user.id), eq(files.path, parent), eq(files.name, name), isNull(files.deletedAt)))
		.get();

	if (existing) return new Response('Already exists', { status: 405 });

	const now = new Date();
	db.insert(files).values({
		id: nanoid(), userId: user.id, name, path: parent,
		size: 0, isFolder: true, createdAt: now, updatedAt: now
	}).run();

	return new Response(null, { status: 201 });
}

async function handleMove(user: DavUser, path: string, request: Request): Promise<Response> {
	const dest = request.headers.get('destination');
	if (!dest) return new Response('Destination required', { status: 400 });

	const destUrl = new URL(dest, request.url);
	const destPath = davPath(destUrl);

	const name = fileName(path);
	const parent = parentPath(path);

	const item = db
		.select()
		.from(files)
		.where(and(eq(files.userId, user.id), eq(files.path, parent), eq(files.name, name), isNull(files.deletedAt)))
		.get();

	if (!item) return new Response('Not Found', { status: 404 });

	const newName = fileName(destPath);
	const newParent = parentPath(destPath);

	db.update(files)
		.set({ name: newName, path: newParent, updatedAt: new Date() })
		.where(eq(files.id, item.id))
		.run();

	// If folder, update children paths
	if (item.isFolder) {
		const oldFolder = parent === '/' ? `/${name}` : `${parent}/${name}`;
		const newFolder = newParent === '/' ? `/${newName}` : `${newParent}/${newName}`;
		const all = db.select().from(files).where(and(eq(files.userId, user.id), isNull(files.deletedAt))).all();
		for (const child of all.filter((f) => f.path === oldFolder || f.path.startsWith(oldFolder + '/'))) {
			const updated = newFolder + child.path.slice(oldFolder.length);
			db.update(files).set({ path: updated }).where(eq(files.id, child.id)).run();
		}
	}

	return new Response(null, { status: 201 });
}

async function handleCopy(user: DavUser, path: string, request: Request): Promise<Response> {
	const dest = request.headers.get('destination');
	if (!dest) return new Response('Destination required', { status: 400 });

	const destUrl = new URL(dest, request.url);
	const destPath = davPath(destUrl);

	const name = fileName(path);
	const parent = parentPath(path);

	const item = db
		.select()
		.from(files)
		.where(and(eq(files.userId, user.id), eq(files.path, parent), eq(files.name, name), isNull(files.deletedAt)))
		.get();

	if (!item || item.isFolder) return new Response('Not Found or folder copy not supported', { status: 404 });

	const newName = fileName(destPath);
	const newParent = parentPath(destPath);

	// Read original file and save as copy
	const origStream = getFileStream(user.id, item.id, item.name);
	const chunks: Buffer[] = [];
	for await (const chunk of origStream) chunks.push(Buffer.from(chunk));
	const data = Buffer.concat(chunks);

	const newId = nanoid();
	await saveFile(user.id, newId, newName, data.buffer);

	const now = new Date();
	db.insert(files).values({
		id: newId, userId: user.id, name: newName, path: newParent,
		mimeType: item.mimeType, size: item.size, isFolder: false,
		createdAt: now, updatedAt: now
	}).run();

	const u = db.select({ used: users.storageUsed }).from(users).where(eq(users.id, user.id)).get()!;
	db.update(users).set({ storageUsed: (u.used ?? 0) + item.size }).where(eq(users.id, user.id)).run();

	return new Response(null, { status: 201 });
}
