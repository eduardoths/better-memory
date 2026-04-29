# Local Setup

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the local database)
- npm (comes with Node.js)

---

## 1. Database

The database runs in Docker. Make sure Docker Desktop is open, then:

```bash
# Start PostgreSQL in the background
docker compose up -d

# Verify it's healthy
docker compose ps
```

The container exposes PostgreSQL on `localhost:5432` with:

| Setting  | Value          |
|----------|----------------|
| Database | `better_memory` |
| User     | `postgres`     |
| Password | `password`     |
| Port     | `5432`         |

### Useful database commands

```bash
# Stop the database (keeps data)
docker compose stop

# Stop and wipe all data (full reset)
docker compose down -v

# Open an interactive psql shell
docker compose exec db psql -U postgres better_memory

# Take a backup
docker compose exec db pg_dump -U postgres better_memory > backup_$(date +%Y%m%d).sql

# Restore a backup
docker compose exec -T db psql -U postgres better_memory < backup_20260428.sql
```

---

## 2. Backend

```bash
cd backend

# First time only
cp .env.example .env
npm install
npm run db:push      # syncs Prisma schema → DB (creates tables)

# Start the dev server (hot-reload via tsx watch)
npm run dev          # → http://localhost:3001
```

The backend watches for file changes and restarts automatically.

### Schema changes

After editing `prisma/schema.prisma`:

```bash
# In development — push schema directly (no migration files)
npm run db:push

# When you want a tracked migration (production-ready)
npm run db:migrate
```

### Other backend commands

```bash
npm run build        # compile TypeScript → dist/
npm run start        # run compiled output (production mode)
npm run db:studio    # open Prisma Studio GUI at http://localhost:5555
npm run db:generate  # regenerate Prisma client after schema changes
```

---

## 3. Frontend

```bash
cd frontend

# First time only
npm install

# Start the dev server
npm run dev          # → http://localhost:5173
```

Vite proxies `/api` and `/uploads` to `localhost:3001`, so the backend must be running.

### Access from iPhone (same Wi-Fi)

The dev server already runs with `--host`.

1. Find your Mac's local IP: `ipconfig getifaddr en0`
2. Open `http://<mac-ip>:5173` on your iPhone
3. Tap **Share → Add to Home Screen** for a PWA-like experience

---

## Quick start (all at once)

```bash
# Terminal 1 — database
docker compose up -d

# Terminal 2 — backend
cd backend && npm run dev

# Terminal 3 — frontend
cd frontend && npm run dev
```

Open http://localhost:5173.
