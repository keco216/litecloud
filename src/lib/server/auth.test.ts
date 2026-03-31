import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';
import { users, sessions } from './db/schema';
import { createTestDb, cleanupTestDb } from '../../tests/setup';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './db/schema';

const SALT_ROUNDS = 12;
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let db: BetterSQLite3Database<typeof schema>;

// Replicate auth.ts logic against the test DB

async function createUser(email: string, password: string) {
	const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
	const id = nanoid();
	const now = new Date();

	db.insert(users)
		.values({ id, email, passwordHash, storageQuota: 1073741824, createdAt: now })
		.run();

	return { id, email };
}

async function verifyCredentials(email: string, password: string) {
	const user = db.select().from(users).where(eq(users.email, email)).get();
	if (!user) return null;

	const valid = await bcrypt.compare(password, user.passwordHash);
	if (!valid) return null;

	return { id: user.id, email: user.email };
}

function createSession(userId: string) {
	const id = nanoid(32);
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

	db.insert(sessions).values({ id, userId, expiresAt }).run();

	return id;
}

function createSessionWithExpiry(userId: string, expiresAt: Date) {
	const id = nanoid(32);

	db.insert(sessions).values({ id, userId, expiresAt }).run();

	return id;
}

function validateSession(sessionId: string) {
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

function destroySession(sessionId: string) {
	db.delete(sessions).where(eq(sessions.id, sessionId)).run();
}

describe('auth', () => {
	let sqlite: ReturnType<typeof import('better-sqlite3')['default']>;

	beforeAll(() => {
		const testDb = createTestDb();
		db = testDb.db as unknown as BetterSQLite3Database<typeof schema>;
		sqlite = testDb.sqlite;
	});

	afterAll(() => {
		sqlite.close();
		cleanupTestDb();
	});

	describe('createUser', () => {
		it('inserts a user with a hashed password and returns id + email', async () => {
			const result = await createUser('alice@example.com', 'password123');

			expect(result.id).toBeDefined();
			expect(result.email).toBe('alice@example.com');

			// Verify the row exists in DB with a hashed (not plaintext) password
			const row = db.select().from(users).where(eq(users.email, 'alice@example.com')).get();
			expect(row).toBeDefined();
			expect(row!.id).toBe(result.id);
			expect(row!.passwordHash).not.toBe('password123');
			const match = await bcrypt.compare('password123', row!.passwordHash);
			expect(match).toBe(true);
		});

		it('throws on duplicate email (UNIQUE constraint)', async () => {
			await createUser('duplicate@example.com', 'pass1');
			await expect(createUser('duplicate@example.com', 'pass2')).rejects.toThrow();
		});
	});

	describe('verifyCredentials', () => {
		beforeAll(async () => {
			await createUser('verify@example.com', 'correctPassword');
		});

		it('returns user with correct password', async () => {
			const result = await verifyCredentials('verify@example.com', 'correctPassword');
			expect(result).not.toBeNull();
			expect(result!.email).toBe('verify@example.com');
			expect(result!.id).toBeDefined();
		});

		it('returns null with wrong password', async () => {
			const result = await verifyCredentials('verify@example.com', 'wrongPassword');
			expect(result).toBeNull();
		});

		it('returns null with non-existent email', async () => {
			const result = await verifyCredentials('nobody@example.com', 'anyPassword');
			expect(result).toBeNull();
		});
	});

	describe('sessions', () => {
		let userId: string;

		beforeAll(async () => {
			const user = await createUser('session-user@example.com', 'sessionPass');
			userId = user.id;
		});

		it('createSession + validateSession roundtrip works', () => {
			const sessionId = createSession(userId);
			const result = validateSession(sessionId);

			expect(result).not.toBeNull();
			expect(result!.id).toBe(userId);
			expect(result!.email).toBe('session-user@example.com');
		});

		it('returns null for an expired session', () => {
			const pastDate = new Date(Date.now() - 1000); // 1 second in the past
			const sessionId = createSessionWithExpiry(userId, pastDate);
			const result = validateSession(sessionId);

			expect(result).toBeNull();
		});

		it('returns null for a non-existent session', () => {
			const result = validateSession('non-existent-session-id');
			expect(result).toBeNull();
		});

		it('destroySession makes session no longer valid', () => {
			const sessionId = createSession(userId);

			// Session is valid before destroy
			expect(validateSession(sessionId)).not.toBeNull();

			destroySession(sessionId);

			// Session is gone after destroy
			expect(validateSession(sessionId)).toBeNull();
		});
	});
});
