/**
 * LiteCloud Sync Engine
 * Watches a local folder and syncs bidirectionally with the LiteCloud API.
 * Can be used standalone (CLI) or embedded in the Tauri app.
 */

export interface SyncConfig {
	serverUrl: string;
	email: string;
	password: string;
	localDir: string;
	syncInterval: number; // ms
}

export interface SyncState {
	status: 'idle' | 'syncing' | 'error';
	lastSync: string | null;
	filesUploaded: number;
	filesDownloaded: number;
	error: string | null;
}

interface RemoteFile {
	id: string;
	name: string;
	path: string;
	size: number;
	mimeType: string | null;
	isFolder: boolean;
	updatedAt: string;
}

export class SyncEngine {
	private config: SyncConfig;
	private cookie = '';
	private state: SyncState = {
		status: 'idle',
		lastSync: null,
		filesUploaded: 0,
		filesDownloaded: 0,
		error: null
	};
	private intervalId: ReturnType<typeof setInterval> | null = null;

	constructor(config: SyncConfig) {
		this.config = config;
	}

	getState(): SyncState {
		return { ...this.state };
	}

	async login(): Promise<boolean> {
		try {
			const res = await fetch(`${this.config.serverUrl}/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: `email=${encodeURIComponent(this.config.email)}&password=${encodeURIComponent(this.config.password)}`,
				redirect: 'manual'
			});

			const setCookie = res.headers.get('set-cookie');
			if (setCookie) {
				const match = setCookie.match(/session=([^;]+)/);
				if (match) this.cookie = `session=${match[1]}`;
			}

			return !!this.cookie;
		} catch (e) {
			this.state.error = `Login failed: ${e}`;
			return false;
		}
	}

	private headers(): Record<string, string> {
		return { Cookie: this.cookie };
	}

	async listRemoteFiles(path = '/'): Promise<RemoteFile[]> {
		// Use WebDAV PROPFIND for listing
		const res = await fetch(`${this.config.serverUrl}/dav${path}`, {
			method: 'PROPFIND',
			headers: {
				Authorization: 'Basic ' + btoa(`${this.config.email}:${this.config.password}`),
				Depth: '1'
			}
		});

		if (!res.ok) return [];

		const xml = await res.text();
		const files: RemoteFile[] = [];

		// Simple XML parsing for DAV responses
		const responses = xml.split('<D:response>').slice(1);
		for (const resp of responses) {
			const hrefMatch = resp.match(/<D:href>([^<]+)<\/D:href>/);
			const sizeMatch = resp.match(/<D:getcontentlength>(\d+)<\/D:getcontentlength>/);
			const isCollection = resp.includes('<D:collection/>');
			const dateMatch = resp.match(/<D:getlastmodified>([^<]+)<\/D:getlastmodified>/);

			if (hrefMatch) {
				const href = decodeURIComponent(hrefMatch[1]).replace(/^\/dav/, '');
				const name = href.split('/').filter(Boolean).pop() || '';
				if (!name) continue; // skip root

				files.push({
					id: '',
					name,
					path: href.replace(`/${name}`, '') || '/',
					size: parseInt(sizeMatch?.[1] || '0'),
					mimeType: null,
					isFolder: isCollection,
					updatedAt: dateMatch?.[1] || new Date().toISOString()
				});
			}
		}

		return files;
	}

	async uploadFile(localPath: string, remotePath: string, fileName: string): Promise<boolean> {
		const fs = await import('node:fs');
		const data = fs.readFileSync(localPath);

		const res = await fetch(`${this.config.serverUrl}/dav${remotePath}/${encodeURIComponent(fileName)}`, {
			method: 'PUT',
			headers: {
				Authorization: 'Basic ' + btoa(`${this.config.email}:${this.config.password}`),
				'Content-Type': 'application/octet-stream'
			},
			body: data
		});

		if (res.ok || res.status === 201 || res.status === 204) {
			this.state.filesUploaded++;
			return true;
		}
		return false;
	}

	async downloadFile(remotePath: string, localPath: string): Promise<boolean> {
		const fs = await import('node:fs');
		const path = await import('node:path');

		const res = await fetch(`${this.config.serverUrl}/dav${remotePath}`, {
			headers: {
				Authorization: 'Basic ' + btoa(`${this.config.email}:${this.config.password}`)
			}
		});

		if (!res.ok) return false;

		const buffer = Buffer.from(await res.arrayBuffer());
		const dir = path.dirname(localPath);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(localPath, buffer);
		this.state.filesDownloaded++;
		return true;
	}

	async sync(): Promise<void> {
		if (this.state.status === 'syncing') return;
		this.state.status = 'syncing';
		this.state.error = null;

		try {
			const fs = await import('node:fs');
			const path = await import('node:path');

			// Get remote file list
			const remoteFiles = await this.listRemoteFiles('/');
			const remoteNames = new Set(remoteFiles.map((f) => f.name));

			// Get local file list
			const localFiles = fs.readdirSync(this.config.localDir);
			const localNames = new Set(localFiles);

			// Upload new local files
			for (const name of localFiles) {
				const fullPath = path.join(this.config.localDir, name);
				const stat = fs.statSync(fullPath);
				if (stat.isDirectory()) continue; // Skip dirs for now

				if (!remoteNames.has(name)) {
					console.log(`[sync] Uploading: ${name}`);
					await this.uploadFile(fullPath, '', name);
				} else {
					// Check size difference — upload if local is newer/different
					const remote = remoteFiles.find((f) => f.name === name);
					if (remote && remote.size !== stat.size) {
						console.log(`[sync] Updating: ${name} (size differs)`);
						await this.uploadFile(fullPath, '', name);
					}
				}
			}

			// Download new remote files
			for (const remote of remoteFiles) {
				if (remote.isFolder) continue;
				if (!localNames.has(remote.name)) {
					console.log(`[sync] Downloading: ${remote.name}`);
					const localPath = path.join(this.config.localDir, remote.name);
					await this.downloadFile(`/${remote.name}`, localPath);
				}
			}

			this.state.lastSync = new Date().toISOString();
			this.state.status = 'idle';
		} catch (e) {
			this.state.error = `Sync failed: ${e}`;
			this.state.status = 'error';
		}
	}

	start(): void {
		console.log(`[sync] Starting sync every ${this.config.syncInterval / 1000}s to ${this.config.serverUrl}`);
		this.sync();
		this.intervalId = setInterval(() => this.sync(), this.config.syncInterval);
	}

	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}
}
