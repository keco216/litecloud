import { db } from './db';
import { users, sessions } from './db/schema';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import type { Cookies } from '@sveltejs/kit';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SALT_ROUNDS = 12;

export async function createUser(email: string, password: string) {
	const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
	const id = nanoid();
	const now = new Date();

	db.insert(users).values({ id, email, passwordHash, createdAt: now }).run();

	return { id, email };
}

export async function verifyCredentials(email: string, password: string) {
	const user = db.select().from(users).where(eq(users.email, email)).get();
	if (!user) return null;

	const valid = await bcrypt.compare(password, user.passwordHash);
	if (!valid) return null;

	return { id: user.id, email: user.email };
}

export function createSession(userId: string, cookies: Cookies) {
	const id = nanoid(32);
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

	db.insert(sessions).values({ id, userId, expiresAt }).run();

	cookies.set('session', id, {
		path: '/',
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax',
		maxAge: SESSION_DURATION_MS / 1000
	});

	return id;
}

export function validateSession(sessionId: string) {
	const session = db
		.select({
			sessionId: sessions.id,
			userId: users.id,
			email: users.email,
			expiresAt: sessions.expiresAt
		})
		.from(sessions)
		.innerJoin(users, eq(sessions.userId, users.id))
		.where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
		.get();

	if (!session) return null;

	return { id: session.userId, email: session.email };
}

export function destroySession(sessionId: string, cookies: Cookies) {
	db.delete(sessions).where(eq(sessions.id, sessionId)).run();
	cookies.delete('session', { path: '/' });
}
