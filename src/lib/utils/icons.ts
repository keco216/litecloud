// File type icons — colors from .stitch/DESIGN.md
type IconDef = { path: string; color: string };

const ICONS: Record<string, IconDef> = {
	folder: {
		path: 'M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V6z',
		color: '#3b82f6' // file-folder
	},
	image: {
		path: 'M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zm13 5.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0zM4 19l4-6 3 4.5 4-6 5 7.5H4z',
		color: '#14b8a6' // file-image (teal)
	},
	video: {
		path: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
		color: '#ec4899' // file-video
	},
	audio: {
		path: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z',
		color: '#f97316' // file-audio
	},
	pdf: {
		path: 'M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2zm7-18v4a1 1 0 001 1h4M9 13h2m-2 3h6m-6 3h3',
		color: '#ef4444' // file-pdf
	},
	archive: {
		path: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
		color: '#f59e0b' // file-archive
	},
	code: {
		path: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
		color: '#10b981' // file-code
	},
	text: {
		path: 'M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2zm7-18v4a1 1 0 001 1h4M9 13h6m-6 3h6m-6 3h3',
		color: '#9ca3af' // file-generic
	},
	spreadsheet: {
		path: 'M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2zm7-18v4a1 1 0 001 1h4M9 11h6M9 14h6M9 17h6M12 11v6',
		color: '#22c55e' // file-sheet
	},
	document: {
		path: 'M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2zm7-18v4a1 1 0 001 1h4',
		color: '#8b5cf6' // file-doc
	},
	generic: {
		path: 'M7 21h10a2 2 0 002-2V9l-5-5H7a2 2 0 00-2 2v13a2 2 0 002 2zm7-18v4a1 1 0 001 1h4',
		color: '#9ca3af' // file-generic
	}
};

const CODE_EXTENSIONS = new Set([
	'js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
	'css', 'scss', 'html', 'xml', 'svelte', 'vue', 'sh', 'bash', 'yml', 'yaml', 'toml'
]);

const SPREADSHEET_TYPES = ['spreadsheet', 'excel', 'csv'];

export function getFileIconDef(mimeType: string | null, isFolder: boolean, name?: string): IconDef {
	if (isFolder) return ICONS.folder;
	if (!mimeType) {
		if (name) {
			const ext = name.split('.').pop()?.toLowerCase() || '';
			if (CODE_EXTENSIONS.has(ext)) return ICONS.code;
		}
		return ICONS.generic;
	}

	if (mimeType.startsWith('image/')) return ICONS.image;
	if (mimeType.startsWith('video/')) return ICONS.video;
	if (mimeType.startsWith('audio/')) return ICONS.audio;
	if (mimeType.includes('pdf')) return ICONS.pdf;
	if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z') || mimeType.includes('tar') || mimeType.includes('gzip'))
		return ICONS.archive;
	if (SPREADSHEET_TYPES.some((t) => mimeType.includes(t)) || mimeType.includes('csv'))
		return ICONS.spreadsheet;
	if (mimeType.includes('document') || mimeType.includes('msword') || mimeType.includes('opendocument'))
		return ICONS.document;
	if (mimeType.startsWith('text/') || mimeType.includes('json')) {
		if (name) {
			const ext = name.split('.').pop()?.toLowerCase() || '';
			if (CODE_EXTENSIONS.has(ext)) return ICONS.code;
		}
		return ICONS.text;
	}

	return ICONS.generic;
}
