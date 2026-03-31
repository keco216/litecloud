import NodeClam from 'clamscan';

const CLAMAV_ENABLED = process.env.CLAMAV_ENABLED !== 'false';

let scanner: any = null;
let initPromise: Promise<any> | null = null;
let isAvailable = false;

async function initScanner() {
	if (!CLAMAV_ENABLED) {
		console.log('[antivirus] ClamAV disabled via CLAMAV_ENABLED=false');
		return null;
	}
	if (scanner) return scanner;
	if (initPromise) return initPromise;

	initPromise = new NodeClam().init({
		removeInfected: false,
		quarantineInfected: false,
		scanLog: null,
		debugMode: false,
		clamdscan: {
			socket: process.env.CLAMAV_SOCKET || '/var/run/clamav/clamd.sock',
			host: process.env.CLAMAV_HOST || 'clamav',
			port: parseInt(process.env.CLAMAV_PORT || '3310'),
			timeout: 60000,
			localFallback: false,
			active: true
		},
		preference: 'clamdscan'
	}).then((s: any) => {
		scanner = s;
		isAvailable = true;
		console.log('[antivirus] ClamAV connected successfully');
		return s;
	}).catch((err: any) => {
		console.warn('[antivirus] ClamAV not available:', err.message);
		console.warn('[antivirus] File scanning disabled');
		isAvailable = false;
		initPromise = null;
		return null;
	});

	return initPromise;
}

// Non-blocking init at startup
initScanner();

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
			setTimeout(() => initScanner(), 30_000);
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
