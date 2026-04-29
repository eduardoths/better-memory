# Deploying to Production

BetterMemory runs as three Docker containers on a VPS:

```
Internet → Nginx (:80) → Express backend (:3001) → PostgreSQL
                  ↓
             React static files (dist/)
```

---

## One-time VPS setup

### 1. Provision a server

Any Linux VPS works (DigitalOcean, Hetzner, Linode). Minimum: 1 vCPU, 1 GB RAM.

### 2. Install Docker

```bash
# On the VPS (Ubuntu/Debian)
curl -fsSL https://get.docker.com | sh
```

### 3. Configure GitHub secrets

In your GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | IP address or domain of your VPS |
| `VPS_USER` | SSH user (e.g. `root`) |
| `VPS_SSH_KEY` | Private SSH key (add the matching public key to `~/.ssh/authorized_keys` on the VPS) |

> `GITHUB_TOKEN` for pushing to GitHub Container Registry (GHCR) is provided automatically — no extra secret needed.

### 4. Clone the repo and configure secrets

```bash
# On the VPS
git clone https://github.com/<you>/better-memory.git
cd better-memory

cp .env.example .env
# Edit .env — set a strong POSTGRES_PASSWORD and update DATABASE_URL:
# DATABASE_URL=postgresql://postgres:<password>@db:5432/better_memory
```

### 5. First deploy

```bash
make deploy    # pulls images from GHCR, starts all containers
make migrate   # runs pending Prisma migrations
```

---

## Subsequent deploys

Every push to `main` triggers the GitHub Actions pipeline automatically:

1. **Test** — runs backend + frontend test suites
2. **Build & push** — builds Docker images, pushes to GHCR
3. **Deploy** — SSHs into the VPS, pulls new images, restarts containers, runs migrations

No manual steps needed after the one-time setup.

---

## Makefile reference

Run these from the project root on the VPS:

```bash
make deploy     # pull latest images from GHCR + restart containers
make migrate    # run pending database migrations (safe to run repeatedly)
make logs       # tail logs from all containers
```

---

## Manual deploy (without CI/CD)

If you want to deploy manually (e.g. first time, or CI is broken):

```bash
# On the VPS
git pull
make deploy
make migrate
```

---

## Environment variables

The `.env` file on the VPS (never committed) must contain:

```env
DATABASE_URL=postgresql://postgres:CHANGE_ME@db:5432/better_memory
POSTGRES_PASSWORD=CHANGE_ME
NODE_ENV=production
PORT=3001
```

---

## Database operations on the VPS

```bash
# Open a psql shell
docker compose -f docker-compose.prod.yml exec db psql -U postgres better_memory

# Take a backup
docker compose -f docker-compose.prod.yml exec db pg_dump -U postgres better_memory > backup_$(date +%Y%m%d).sql

# Restore a backup
docker compose -f docker-compose.prod.yml exec -T db psql -U postgres better_memory < backup_20260428.sql
```

---

## HTTPS (optional next step)

This setup runs on HTTP port 80. To add TLS:

1. Install Certbot on the VPS
2. Use the [Nginx Certbot plugin](https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal) to obtain a certificate
3. Update `nginx/nginx.conf` to redirect HTTP → HTTPS and add the `ssl_certificate` directives
