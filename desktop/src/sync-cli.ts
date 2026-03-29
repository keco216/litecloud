#!/usr/bin/env node

/**
 * LiteCloud Sync CLI
 * Usage: node --loader ts-node/esm src/sync-cli.ts --url http://localhost:3000 --email user@example.com --password secret --dir ./my-sync-folder
 *
 * Or with env vars:
 *   LITECLOUD_URL=http://localhost:3000
 *   LITECLOUD_EMAIL=user@example.com
 *   LITECLOUD_PASSWORD=secret
 *   LITECLOUD_SYNC_DIR=./my-sync-folder
 */

import { SyncEngine } from './sync-engine.js';
import { mkdirSync } from 'node:fs';

function getArg(name: string, envName: string): string {
	const idx = process.argv.indexOf(`--${name}`);
	if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
	return process.env[envName] || '';
}

const config = {
	serverUrl: getArg('url', 'LITECLOUD_URL') || 'http://localhost:3000',
	email: getArg('email', 'LITECLOUD_EMAIL'),
	password: getArg('password', 'LITECLOUD_PASSWORD'),
	localDir: getArg('dir', 'LITECLOUD_SYNC_DIR') || './litecloud-sync',
	syncInterval: parseInt(getArg('interval', 'LITECLOUD_SYNC_INTERVAL') || '30000')
};

if (!config.email || !config.password) {
	console.error('Usage: litecloud-sync --url URL --email EMAIL --password PASSWORD --dir DIR');
	console.error('  Or set LITECLOUD_URL, LITECLOUD_EMAIL, LITECLOUD_PASSWORD, LITECLOUD_SYNC_DIR');
	process.exit(1);
}

mkdirSync(config.localDir, { recursive: true });

const engine = new SyncEngine(config);

console.log(`LiteCloud Sync`);
console.log(`  Server:   ${config.serverUrl}`);
console.log(`  User:     ${config.email}`);
console.log(`  Local:    ${config.localDir}`);
console.log(`  Interval: ${config.syncInterval / 1000}s`);
console.log('');

engine.start();

// Graceful shutdown
process.on('SIGINT', () => {
	console.log('\n[sync] Stopping...');
	engine.stop();
	const state = engine.getState();
	console.log(`[sync] Uploaded: ${state.filesUploaded}, Downloaded: ${state.filesDownloaded}`);
	process.exit(0);
});
