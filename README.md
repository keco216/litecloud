# LiteCloud

A minimal, self-hosted personal cloud for families.
One Docker container, one SQLite file, one uploads folder — done.

Built with SvelteKit 2, Svelte 5, TypeScript, and Material Design 3.

## Features

- **File management** — Upload, download, organize, drag & drop with real-time progress
- **Sharing** — Public links with password, expiry, download limits, folder ZIP downloads
- **Photo timeline** — EXIF-based gallery with GPS, lightbox navigation
- **Search** — Full-text search (SQLite FTS5) across filenames and content
- **Tags & favorites** — Color-coded tags, star files, filter and organize
- **Versioning** — Automatic file versioning (last 5 versions), restore anytime
- **E2E encryption** — Client-side AES-256-GCM, server never sees plaintext
- **2FA** — TOTP two-factor authentication (Google Authenticator / Authy)
- **Antivirus** — ClamAV background scanning with automatic quarantine
- **WebDAV** — Mount as network drive in Finder, Explorer, or Nautilus
- **Backups** — Automated daily + weekly SQLite backups with rotation
- **Dark mode** — System-auto or manual toggle, full M3 theming

## Quick Start

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000), create an account, start uploading.

ClamAV starts automatically for antivirus scanning (~90s startup). Set `CLAMAV_ENABLED=false` to disable.

### With HTTPS (Caddy)

1. Edit `Caddyfile` — set your domain
2. Uncomment the Caddy section in `docker-compose.yml`
3. `docker compose up -d`

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ORIGIN` | `http://localhost:3000` | Public URL |
| `SESSION_SECRET` | `change-me-in-production` | Session signing key |
| `STORAGE_QUOTA` | `1GB` | Per-user quota (supports TB/GB/MB) |
| `CLAMAV_ENABLED` | `true` | Enable antivirus scanning |
| `CLAMAV_HOST` | `clamav` | ClamAV daemon hostname |
| `CLAMAV_PORT` | `3310` | ClamAV daemon TCP port |

## WebDAV

Mount your cloud as a network drive:

- **macOS** — Finder > Go > Connect to Server > `http://host:3000/dav/`
- **Windows** — Map Network Drive > `\\host:3000\dav`
- **Linux** — Nautilus > `dav://host:3000/dav/`

Authenticate with your LiteCloud email and password.

## Development

```bash
git clone https://github.com/keco216/litecloud.git
cd litecloud
npm install
npm run dev    # http://localhost:5173
npm test       # 49 tests
```

## Tech Stack

SvelteKit 2 · Svelte 5 · TypeScript · SQLite + Drizzle ORM · Tailwind CSS 4 · Material Design 3 · sharp · ClamAV · Vitest · Node.js 20+

## License

MIT
