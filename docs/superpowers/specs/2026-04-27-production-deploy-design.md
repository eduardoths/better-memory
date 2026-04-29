# Production Deploy Design

**Date:** 2026-04-27
**Stack:** React 18 + Vite · Express + TypeScript · PostgreSQL · Docker

---

## Goal

Package the better-memory app for production using Docker, deploy it on a VPS, and automate the release pipeline via GitHub Actions + GitHub Container Registry (GHCR).

---

## Architecture

Three containers managed by `docker-compose.prod.yml`:

```
Internet
    │
  [:80]
    │
 ┌──▼──────┐
 │  Nginx  │  /              → React static build (dist/)
 │         │  /api/*         → Express :3001
 │         │  /uploads/*     → Express :3001
 └──┬──────┘
    │
 ┌──▼──────────┐     ┌──────────────┐
 │   Backend   │────▶│  PostgreSQL  │
 │  Express    │     │  named vol   │
 │  :3001      │     └──────────────┘
 │  named vol  │
 │  /uploads   │
 └─────────────┘
```

- Nginx serves the pre-built React `dist/` for all non-API routes (SPA fallback to `index.html`)
- Nginx proxies `/api/*` and `/uploads/*` to the Express backend
- PostgreSQL data persisted in `postgres_data` named volume
- Uploaded images persisted in `uploads_data` named volume mounted at `backend/uploads/`

---

## Files to Create

```
better-memory/
├── backend/
│   └── Dockerfile                      # multi-stage TS build → node runner
├── frontend/
│   └── Dockerfile                      # vite build → nginx static server
├── nginx/
│   └── nginx.conf                      # reverse proxy + SPA fallback
├── docker-compose.prod.yml             # production compose (3 services)
├── .env.example                        # committed secret template
└── Makefile                            # deploy / migrate / logs shortcuts
```

### `backend/Dockerfile`

Two-stage build:
1. **Builder** (`node:20-alpine`): `npm ci && npx prisma generate && npm run build`
2. **Runner** (`node:20-alpine`): copy `dist/` + `node_modules` + `prisma/`, `CMD ["node", "dist/index.js"]`

### `frontend/Dockerfile`

Two-stage build:
1. **Builder** (`node:20-alpine`): `npm ci && npm run build`
2. **Runner** (`nginx:alpine`): copy `dist/` to `/usr/share/nginx/html`, copy `nginx.conf`

### `nginx/nginx.conf`

- Listen on port 80
- `location /api/` → `proxy_pass http://backend:3001`
- `location /uploads/` → `proxy_pass http://backend:3001`
- `location /` → `try_files $uri $uri/ /index.html` (SPA fallback)

### `docker-compose.prod.yml`

Three services:
| Service | Image | Ports | Volumes |
|---|---|---|---|
| `db` | `postgres:16-alpine` | internal only | `postgres_data:/var/lib/postgresql/data` |
| `backend` | `ghcr.io/<user>/better-memory-backend:latest` | internal :3001 | `uploads_data:/app/uploads` |
| `frontend` | `ghcr.io/<user>/better-memory-frontend:latest` | `80:80` | — |

- `db` has a healthcheck; `backend` depends on `db` being healthy
- All services: `restart: unless-stopped`
- `backend` receives env vars from `.env` on the VPS

### `.env.example`

```env
DATABASE_URL=postgresql://postgres:CHANGE_ME@db:5432/better_memory
POSTGRES_PASSWORD=CHANGE_ME
NODE_ENV=production
PORT=3001
```

### `Makefile`

```makefile
deploy:
	docker compose -f docker-compose.prod.yml pull
	docker compose -f docker-compose.prod.yml up -d

migrate:
	docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy

logs:
	docker compose -f docker-compose.prod.yml logs -f
```

---

## CI/CD Pipeline

### GitHub Actions — `.github/workflows/deploy.yml`

Triggered on every push. Jobs:

#### 1. `test` (all branches)
- Runs in parallel: `npm test` for backend, `npm test` for frontend
- Uses a `postgres:16-alpine` service container for backend tests

#### 2. `build-push` (main only, after test passes)
- Logs into GHCR with `GITHUB_TOKEN`
- Builds and pushes:
  - `ghcr.io/<user>/better-memory-backend:latest`
  - `ghcr.io/<user>/better-memory-frontend:latest`
- Uses `docker/build-push-action` with layer caching via GHCR cache

#### 3. `deploy` (main only, after build-push passes)
- SSHs into VPS using `appleboy/ssh-action`
- Runs: `cd better-memory && git pull && make deploy && make migrate`

### GitHub Secrets Required

| Secret | Value |
|---|---|
| `VPS_HOST` | IP address or domain of the VPS |
| `VPS_USER` | SSH user (e.g. `root` or `deploy`) |
| `VPS_SSH_KEY` | Private SSH key (VPS has public key in `authorized_keys`) |

> `GITHUB_TOKEN` is auto-provided by Actions for GHCR access — no manual secret needed.

### Branch Strategy

| Event | test | build-push | deploy |
|---|---|---|---|
| Push to any branch / PR | ✅ | ❌ | ❌ |
| Push to `main` | ✅ | ✅ | ✅ |

---

## One-Time VPS Setup

```bash
# 1. Install Docker + Docker Compose on VPS
# 2. Clone the repo
git clone https://github.com/<user>/better-memory.git && cd better-memory

# 3. Create .env from template
cp .env.example .env
# Edit .env with strong POSTGRES_PASSWORD and correct DATABASE_URL

# 4. First deploy
make deploy
make migrate
```

After this, every push to `main` triggers a fully automated deploy.

---

## Constraints & Decisions

- **No HTTPS in this spec** — SSL/TLS via Certbot can be layered on top of Nginx in a follow-up; this spec focuses on getting the stack containerised and automated.
- **Named volumes for uploads** — simple and zero-code-change; migrate to object storage (R2/S3) later if needed.
- **GHCR for image registry** — free, integrated with GitHub, no extra account needed.
- **Migrations run as part of deploy** — `prisma migrate deploy` is safe to run on every deploy (idempotent).
