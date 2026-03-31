import NodeClam from 'clamscan';

const CLAMAV_ENABLED = process.env.CLAMAV_ENABLED !== 'false';
const CLAMAV_HOST = process.env.CLAMAV_HOST || '';
const CLAMAV_PORT = parseInt(process.env.CLAMAV_PORT || '3310', 10);
const CLAMAV_SOCKET = process.env.CLAMAV_SOCKET || '';

// TCP wins over socket; if neither set, default to TCP host 'clamav'
const useSocket = !!CLAMAV_SOCKET && !CLAMAV_HOST;
const effectiveHost = CLAMAV_HOST || 'clamav';

let scanner: any = null;
let initPromise: Promise<any> | null = null;
let isAvailable = false;
let retryCount = 0;
const MAX_INIT_RETRIES = 3;

const clamConfig = {
	removeInfected: false,
	quarantineInfected: false,
	scanLog: null,
	debugMode: false,
	clamdscan: {
		active: true,
		timeout: 60000,
		localFallback: false,
		host: useSocket ? undefined : effectiveHost,
		port: useSocket ? undefined : CLAMAV_PORT,
		socket: useSocket ? CLAMAV_SOCKET : undefined
	},
	preference: 'clamdscan'
};

async function initScanner() {
	if (!CLAMAV_ENABLED) {
		console.log('[antivirus] ClamAV disabled via CLAMAV_ENABLED=false');
		return null;
	}
	if (scanner) return scanner;
	if (retryCount >= MAX_INIT_RETRIES) {
		console.log(`[antivirus] Gave up after ${MAX_INIT_RETRIES} attempts`);
		return null;
	}
	if (initPromise) return initPromise;

	retryCount++;

	if (useSocket) {
		console.log(`[antivirus] Init attempt ${retryCount}/${MAX_INIT_RETRIES} via Unix Socket: ${CLAMAV_SOCKET}`);
	} else {
		console.log(`[antivirus] Init attempt ${retryCount}/${MAX_INIT_RETRIES} via TCP: ${effectiveHost}:${CLAMAV_PORT}`);
	}

	initPromise = new NodeClam().init(clamConfig)
		.then((s: any) => {
			scanner = s;
			isAvailable = true;
			retryCount = 0;
			console.log('[antivirus] ClamAV connected successfully');
			return s;
		})
		.catch((err: any) => {
			console.warn(`[antivirus] Connection failed: ${err.message}`);
			isAvailable = false;
			scanner = null;
			initPromise = null;

			if (retryCount < MAX_INIT_RETRIES) {
				const delay = retryCount * 30_000; // 30s, 60s, 90s
				console.log(`[antivirus] Retrying in ${delay / 1000}s...`);
				setTimeout(() => initScanner(), delay);
			} else {
				console.log('[antivirus] ClamAV not reachable — file scanning disabled');
			}

			return null;
		});

	return initPromise;
}

// Non-blocking init at startup
initScanner();

export function isScannerAvailable(): boolean {
	return isAvailable && scanner !== null;
}

export interface ScanResult {
	scanned: boolean;
	isInfected: boolean;
	viruses: string[];
	error?: string;
	scanTimeMs: number;
}

export async function scanFile(filePath: string): Promise<ScanResult> {
	const start = Date.now();

	if (!CLAMAV_ENABLED || !isAvailable) {
		return { scanned: false, isInfected: false, viruses: [], error: 'ClamAV not available', scanTimeMs: 0 };
	}

	try {
		const clam = await initScanner();
		if (!clam) return { scanned: false, isInfected: false, viruses: [], error: 'Not initialized', scanTimeMs: 0 };

		const { isInfected, viruses } = await clam.isInfected(filePath);
		return { scanned: true, isInfected: isInfected ?? false, viruses: viruses ?? [], scanTimeMs: Date.now() - start };
	} catch (err: any) {
		console.error('[antivirus] Scan error:', err.message);
		if (err.message?.includes('ECONNREFUSED') || err.message?.includes('ENOENT')) {
			isAvailable = false;
			scanner = null;
			initPromise = null;
			if (retryCount < MAX_INIT_RETRIES) {
				setTimeout(() => initScanner(), 30_000);
			}
		}
		return { scanned: false, isInfected: false, viruses: [], error: err.message, scanTimeMs: Date.now() - start };
	}
}

export async function getStatus(): Promise<{ available: boolean; version?: string; error?: string }> {
	if (!CLAMAV_ENABLED) return { available: false, error: 'Disabled' };
	if (!isAvailable || !scanner) return { available: false, error: 'Not connected' };
	try {
		const version = await scanner.getVersion();
		return { available: true, version: version || 'unknown' };
	} catch (err: any) {
		return { available: false, error: err.message };
	}
}

export async function isHealthy(): Promise<boolean> {
	if (!CLAMAV_ENABLED || !isAvailable || !scanner) return false;
	try {
		const v = await scanner.getVersion();
		return !!v;
	} catch { return false; }
}
