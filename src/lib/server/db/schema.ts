import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	storageQuota: integer('storage_quota').default(1073741824), // 1 GB
	storageUsed: integer('storage_used').default(0),
	// E2E encryption
	encryptionSalt: text('encryption_salt'), // PBKDF2 salt (base64)
	encryptedMasterKey: text('encrypted_master_key'), // AES-wrapped master key (base64)
	masterKeyIv: text('master_key_iv'), // IV used to wrap master key (base64)
	// TOTP 2FA
	totpSecret: text('totp_secret'), // base32 secret
	totpEnabled: integer('totp_enabled', { mode: 'boolean' }).default(false),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

export const files = sqliteTable('files', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	name: text('name').notNull(),
	path: text('path').notNull(), // virtual path e.g. "/"
	mimeType: text('mime_type'),
	size: integer('size').notNull(),
	isFolder: integer('is_folder', { mode: 'boolean' }).default(false),
	encrypted: integer('encrypted', { mode: 'boolean' }).default(false),
	iv: text('iv'), // AES-GCM IV (base64)
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const fileMetadata = sqliteTable('file_metadata', {
	id: text('id').primaryKey(), // same as file id
	fileId: text('file_id')
		.notNull()
		.references(() => files.id),
	// EXIF
	dateTaken: integer('date_taken', { mode: 'timestamp' }),
	latitude: text('latitude'), // stored as text for precision
	longitude: text('longitude'),
	camera: text('camera'),
	width: integer('width'),
	height: integer('height'),
	// Extracted text (for FTS)
	extractedText: text('extracted_text')
});

export const shares = sqliteTable('shares', {
	id: text('id').primaryKey(),
	token: text('token').notNull().unique(),
	fileId: text('file_id')
		.notNull()
		.references(() => files.id),
	userId: text('user_id')
		.notNull()
		.references(() => users.id),
	password: text('password'),
	expiresAt: integer('expires_at', { mode: 'timestamp' }),
	downloadCount: integer('download_count').default(0),
	maxDownloads: integer('max_downloads'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});
