# LiteCloud

A minimal, self-hosted personal cloud for families. Think Google Drive minus the complexity.
One Docker container, one SQLite file, one uploads folder -- done.

Built with SvelteKit + TypeScript, designed following Google Material Design 3.

## Features

### Core
- **File management** -- Upload, download, rename, move, delete, organize in folders
- **Drag & drop** -- Drop files anywhere with real-time progress tracking
- **File sharing** -- Public links with optional password, expiry, download limits. Share entire folders as ZIP
- **Photo timeline** -- EXIF-based chronological gallery grouped by month, with GPS support, lightbox with prev/next navigation
- **Full-text search** -- SQLite FTS5 instant search across filenames and text content

### Organization
- **Tags & favorites** -- Color-coded tags, star/favorite files, filter by tags in file browser
- **File versioning** -- Keeps last 5 versions on overwrite, restore previous versions, version history in preview
- **Trash / Soft delete** -- 30-day retention with auto-purge, undo support, restore from trash
- **Storage analytics** -- Dashboard with donut chart, monthly uploads bar chart, top folders, largest files

### Security
- **E2E encryption** -- AES-256-GCM client-side encryption, PBKDF2 key derivation, server never sees plaintext
- **2FA / TOTP** -- Google Authenticator / Authy compatible two-factor authentication
- **Rate limiting** -- Brute force protection on login, API, share passwords with escalating lockout
- **Antivirus** -- ClamAV integration for background file scanning, automatic quarantine
- **Security headers** -- CSP, X-Frame-Options, HSTS, Referrer-Policy

### Infrastructure
- **WebDAV** -- Mount as network drive in Finder, Explorer, or Nautilus
- **Auto-backups** -- Daily + weekly SQLite backups with automatic rotation
- **Thumbnails** -- Server-side thumbnail generation with sharp (sm/md/lg WebP)
- **Notifications** -- In-app notifications for storage warnings, logins, share downloads, backup status
- **Docker** -- Multi-container deployment with ClamAV + Caddy auto-HTTPS option

### UX
- **Collapsible sidebar** -- Expand/collapse with M3 animation, Ctrl+B shortcut, persisted state
- **Dual view** -- List and grid view with persistent preference
- **i18n** -- German and English with auto-detection, easy to add more languages
- **Dark mode** -- System-auto, manual light/dark toggle
- **M3 Motion** -- Material Design 3 easing curves, animated icons (SVG morph), icon fill transitions
- **Keyboard shortcuts** -- Ctrl+U upload, Del delete, Ctrl+A select all, Ctrl+B sidebar, ? help
- **File preview** -- Inline preview for images, video, audio, PDF, text/code files

### Testing
- **Test suite** -- 49 tests covering auth, crypto, storage, search, trash, rate limiting

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | SvelteKit 2 + Svelte 5 (Runes) + TypeScript |
| Database | SQLite (WAL mode) + Drizzle ORM |
| Storage | Local filesystem |
| Auth | Cookie sessions + bcrypt (12 rounds) |
| Encryption | Web Crypto API (AES-256-GCM, PBKDF2) |
| Design | Material Design 3 |
| Styling | Tailwind CSS 4 |
| Icons | Material Symbols Outlined (variable font) |
| Thumbnails | sharp (WebP) |
| Antivirus | ClamAV (via clamscan) |
| Testing | Vitest |
| Runtime | Node.js 20+ |

## Quick Start

### Development

```bash
git clone https://github.com/keco216/litecloud.git
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

ClamAV starts automatically for antivirus scanning (~60-90s startup, needs ~800MB RAM).
Set `CLAMAV_ENABLED=false` in `.env` to disable.

### Docker with HTTPS

1. Edit `Caddyfile` -- replace `cloud.example.com` with your domain
2. Uncomment the Caddy section in `docker-compose.yml`
3. Run `docker compose up -d`

Caddy automatically provisions Let's Encrypt certificates.

### Run Tests

```bash
npm test
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
| `STORAGE_QUOTA` | `1GB` | Per-user storage quota (supports TB/GB/MB) |
| `BACKUP_DIR` | `./data/backups` | Backup storage path |
| `EXTERNAL_BACKUP_DIR` | (none) | Optional external backup path |
| `CLAMAV_ENABLED` | `true` | Enable/disable antivirus scanning |
| `CLAMAV_SOCKET` | `/var/run/clamav/clamd.sock` | ClamAV Unix socket path |
| `QUARANTINE_DIR` | `./data/quarantine` | Quarantine directory for infected files |

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
| GET | `/api/health` | Health check + ClamAV status |
| POST | `/api/files/upload` | Upload files (multipart) |
| GET | `/api/files/download?id=X` | Download file (streaming) |
| DELETE | `/api/files/delete` | Soft-delete files/folders |
| POST | `/api/files/mkdir` | Create folder |
| POST | `/api/files/rename` | Rename file/folder |
| POST | `/api/files/move` | Move files to folder |
| POST | `/api/files/star` | Star/unstar files |
| GET | `/api/files/trash` | List trashed files |
| POST | `/api/files/trash` | Restore, purge, or empty trash |
| GET | `/api/files/thumbnail?id=X&size=sm` | Get image thumbnail |
| GET | `/api/files/versions?id=X` | List file versions |
| POST | `/api/files/versions` | Restore a file version |
| POST | `/api/share/create` | Create share link (files + folders) |
| GET | `/api/share/[token]` | Public download (ZIP for folders) |
| GET | `/api/share/[token]/browse` | Browse shared folder contents |
| DELETE | `/api/share/revoke` | Revoke share link |
| GET | `/api/share/list` | List user shares |
| GET | `/api/search?q=X` | Full-text search |
| GET | `/api/photos` | Photo timeline data |
| GET/POST/DELETE | `/api/backup` | Backup management |
| GET/POST/DELETE | `/api/tags` | Tag CRUD |
| POST/DELETE | `/api/tags/assign` | Assign/remove tags from files |
| GET/POST | `/api/notifications` | Notifications list/mark-read |
| GET | `/api/storage/analytics` | Storage analytics data |
| GET/POST | `/api/antivirus` | Antivirus status/rescan |
| POST | `/api/admin/generate-thumbnails` | Batch generate thumbnails |
| POST | `/api/auth/totp/setup` | TOTP 2FA setup |
| POST | `/api/auth/totp/verify` | TOTP verification |
| `PROPFIND/GET/PUT/...` | `/dav/*` | WebDAV protocol |

## Project Structure

```
src/
├── lib/
│   ├── server/
│   │   ├── db/             # Drizzle schema + SQLite + FTS5
│   │   ├── auth.ts         # Session management + bcrypt
│   │   ├── storage.ts      # File I/O operations
│   │   ├── webdav.ts       # Full WebDAV protocol handler
│   │   ├── search.ts       # FTS5 indexing + search
│   │   ├── backup.ts       # Automated backup + rotation
│   │   ├── exif.ts         # EXIF metadata extraction
│   │   ├── thumbnails.ts   # sharp thumbnail generation
│   │   ├── versions.ts     # File versioning (max 5)
│   │   ├── trash.ts        # Auto-purge cron (30 days)
│   │   ├── notifications.ts # In-app notification service
│   │   ├── ratelimit.ts    # In-memory rate limiter
│   │   ├── antivirus.ts    # ClamAV integration
│   │   └── scan-queue.ts   # Background scan queue
│   ├── components/         # Svelte UI components (M3)
│   │   ├── settings/       # Settings tab components
│   │   ├── AnimatedIcon.svelte  # SVG morph animation
│   │   ├── TagPicker.svelte     # Tag assignment picker
│   │   └── ...
│   ├── i18n/               # Translations (en.json, de.json)
│   ├── stores/             # Sidebar state (Svelte 5 runes)
│   ├── utils/              # filesize, timeago, icon-paths
│   └── crypto.ts           # Client-side E2E encryption
├── routes/
│   ├── (app)/              # Auth-guarded pages
│   │   ├── files/          # File browser (list + grid)
│   │   ├── photos/         # Photo timeline gallery
│   │   ├── shares/         # Share link management
│   │   ├── trash/          # Trash / recycle bin
│   │   ├── storage/        # Storage analytics dashboard
│   │   └── settings/       # Tabbed settings (General, Tags, Security, Advanced)
│   ├── api/                # REST API endpoints
│   ├── share/[token]/      # Public share page with folder browsing
│   ├── login/              # Authentication + TOTP
│   └── register/           # Account creation
├── tests/                  # Test setup + helpers
├── hooks.server.ts         # Session + rate limiting + security headers
└── app.css                 # M3 design tokens + motion + component styles
```

## Design

UI follows [Material Design 3](https://m3.material.io) guidelines:

- **Color system** -- Full M3 tonal palette with light/dark mode, 40+ color tokens
- **Typography** -- M3 type scale (Display through Label), Inter font
- **Elevation** -- 6-level shadow system with dark mode adjustments
- **Shape** -- M3 corner radius scale (XS 4px through Full pill)
- **Motion** -- M3 easing (standard, emphasized-decel/accel) + duration tokens (short1-4, medium1-4, long1-4), asymmetric open/close timing, animated icon fills, SVG path morphing
- **Components** -- Buttons, icon buttons, FABs, cards, chips, dialogs, snackbars, navigation drawer (collapsible), segmented buttons, checkboxes, switches, menus, tooltips (portal-based), badges, progress indicators, search bar, top app bar, list items
- **State layers** -- Hover (8%), focus (12%), pressed (12%) opacity overlays
- **Icons** -- Material Symbols Outlined with variable font FILL axis transitions + SVG morph animations (flubber)

## Security

- Passwords hashed with bcrypt (12 rounds)
- HTTPOnly session cookies (SameSite=Lax, 30-day expiry)
- Client-side E2E encryption (AES-256-GCM) -- server never sees plaintext
- PBKDF2 key derivation (600,000 iterations)
- TOTP two-factor authentication
- Rate limiting with escalating lockout (login, API, share, upload, register)
- ClamAV antivirus scanning with automatic quarantine
- Security headers (CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- WebDAV Basic auth with path traversal prevention
- CORS scoped to same-origin

## License

MIT
