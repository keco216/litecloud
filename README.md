# LiteCloud

A minimal, self-hosted personal cloud for families. Think Google Drive minus the complexity.
One Docker container, one SQLite file, one uploads folder -- done.

Built with SvelteKit + TypeScript, designed following Google Material Design 3.

## Features

- **File management** -- Upload, download, rename, delete, organize in folders
- **Drag & drop** -- Drop files anywhere with real-time progress tracking
- **File sharing** -- Public links with optional password, expiry, and download limits
- **Photo timeline** -- EXIF-based chronological gallery grouped by month, with GPS support
- **Full-text search** -- SQLite FTS5 instant search across filenames and text content
- **File preview** -- Inline preview for images and text/code files with encryption support
- **E2E encryption** -- AES-256-GCM client-side encryption, PBKDF2 key derivation, server never sees plaintext
- **2FA / TOTP** -- Google Authenticator / Authy compatible two-factor authentication
- **WebDAV** -- Mount as network drive in Finder, Explorer, or Nautilus
- **Auto-backups** -- Daily + weekly SQLite backups with automatic rotation
- **Dual view** -- List and grid view with persistent preference
- **Keyboard shortcuts** -- Ctrl+U upload, Del delete, Ctrl+A select all, Esc deselect
- **Dark mode** -- System-auto, manual light/dark toggle, Google Drive dark palette
- **Docker** -- Single container deployment with Caddy auto-HTTPS option

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | SvelteKit 2 + Svelte 5 + TypeScript |
| Database | SQLite (WAL mode) + Drizzle ORM |
| Storage | Local filesystem |
| Auth | Cookie sessions + bcrypt (12 rounds) |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2) |
| Design | Material Design 3 |
| Styling | Tailwind CSS 4 |
| Icons | Material Symbols Outlined |
| Runtime | Node.js 20+ |

## Quick Start

### Development

```bash
git clone https://github.com/kevincolic/litecloud.git
cd litecloud
npm install
npm run dev
```

Open http://localhost:5173, create an account, start uploading.

### Docker

```bash
docker compose up -d
```

Open http://localhost:3000. Data persists in the `litecloud-data` volume.

### Docker with HTTPS

1. Edit `Caddyfile` -- replace `cloud.example.com` with your domain
2. Uncomment the Caddy section in `docker-compose.yml`
3. Run `docker compose up -d`

Caddy automatically provisions Let's Encrypt certificates.

### Build manually

```bash
npm run build
node build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PATH` | `./data/litecloud.db` | SQLite database path |
| `UPLOAD_DIR` | `./data/uploads` | File storage path |
| `PORT` | `3000` | Server port |
| `ORIGIN` | `http://localhost:3000` | Public URL |
| `BODY_SIZE_LIMIT` | `Infinity` | Max upload size |
| `SESSION_SECRET` | (random) | Session signing key |
| `BACKUP_DIR` | `./data/backups` | Backup storage path |
| `EXTERNAL_BACKUP_DIR` | (none) | Optional external backup path |

## WebDAV

Mount your cloud as a network drive:

| OS | How |
|----|-----|
| **macOS** | Finder > Go > Connect to Server > `http://host:3000/dav/` |
| **Windows** | Map Network Drive > `\\host:3000\dav` |
| **Linux** | `davfs2` or Nautilus > `dav://host:3000/dav/` |

Authenticate with your LiteCloud email and password.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/files/upload` | Upload files (multipart) |
| GET | `/api/files/download?id=X` | Download file (streaming) |
| DELETE | `/api/files/delete` | Delete files/folders |
| POST | `/api/files/mkdir` | Create folder |
| POST | `/api/files/rename` | Rename file/folder |
| POST | `/api/share/create` | Create share link |
| GET | `/api/share/[token]` | Public file download |
| DELETE | `/api/share/revoke` | Revoke share link |
| GET | `/api/share/list` | List user shares |
| GET | `/api/search?q=X` | Full-text search |
| GET | `/api/photos` | Photo timeline data |
| GET/POST/DELETE | `/api/backup` | Backup management |
| POST | `/api/auth/totp/setup` | TOTP 2FA setup |
| POST | `/api/auth/totp/verify` | TOTP verification |
| `PROPFIND/GET/PUT/...` | `/dav/*` | WebDAV protocol |

## Project Structure

```
src/
├── lib/
│   ├── server/           # DB, auth, storage, search, EXIF, backup, WebDAV
│   │   ├── db/           # Drizzle schema + SQLite setup + FTS5
│   │   ├── auth.ts       # Session management + bcrypt
│   │   ├── storage.ts    # File I/O operations
│   │   ├── webdav.ts     # Full WebDAV protocol handler
│   │   ├── search.ts     # FTS5 indexing + search
│   │   ├── backup.ts     # Automated backup + rotation
│   │   └── exif.ts       # EXIF metadata extraction
│   ├── components/       # Svelte UI components (M3)
│   │   ├── Tooltip.svelte
│   │   ├── ShareDialog.svelte
│   │   ├── FilePreview.svelte
│   │   ├── Toolbar.svelte
│   │   ├── Toast.svelte
│   │   ├── UploadProgress.svelte
│   │   └── ...
│   ├── utils/            # Shared utilities
│   └── crypto.ts         # Client-side E2E encryption (Web Crypto API)
├── routes/
│   ├── (app)/            # Auth-guarded pages
│   │   ├── files/        # File browser (list + grid)
│   │   ├── photos/       # Photo timeline gallery
│   │   ├── shares/       # Share link management
│   │   └── settings/     # Appearance, 2FA, backups, WebDAV
│   ├── api/              # REST API endpoints
│   ├── share/[token]/    # Public share download page
│   ├── login/            # Authentication + TOTP
│   └── register/         # Account creation
├── hooks.server.ts       # Session middleware + WebDAV routing
└── app.css               # M3 design tokens + component styles
```

## Design

UI follows [Material Design 3](https://m3.material.io) guidelines:

- **Color system** -- Full M3 tonal palette with light/dark mode, 40+ color tokens
- **Typography** -- M3 type scale (Display through Label), Inter font
- **Elevation** -- 6-level shadow system with dark mode adjustments
- **Shape** -- M3 corner radius scale (XS 4px through Full pill)
- **Motion** -- M3 easing curves + duration tokens, spring-based animations
- **Components** -- M3 buttons, icon buttons, FABs, cards, chips, dialogs, snackbars, navigation drawer, segmented buttons, checkboxes, switches, menus, tooltips, badges, progress indicators, search bar, top app bar, list items, dividers
- **State layers** -- Hover (8%), focus (12%), pressed (12%) opacity overlays
- **Icons** -- Material Symbols Outlined with fill transitions on active state

## Security

- Passwords hashed with bcrypt (12 rounds)
- HTTPOnly session cookies (SameSite=Lax, 30-day expiry)
- Client-side E2E encryption (AES-256-GCM) -- server never sees plaintext
- PBKDF2 key derivation (600,000 iterations)
- TOTP two-factor authentication
- WebDAV Basic auth
- CORS scoped to same-origin
- Path traversal prevention

## License

MIT
