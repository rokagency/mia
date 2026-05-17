# Deskia — Production Deployment Guide

This is the step-by-step to deploy Deskia from zero to a live URL at
`https://mia.agenciarok.es` on a DigitalOcean droplet that **already
runs host-level Nginx** for multiple existing sites.

Target stack:
- 1 DigitalOcean droplet (Ubuntu 22.04, ≥ 2 GB RAM)
- Domain (`mia.agenciarok.es`) already pointed at the droplet
- **Host Nginx** as the public reverse proxy (already installed,
  already serving other domains — DO NOT stop it)
- **Certbot** on the host for Let's Encrypt SSL
- Docker + Docker Compose running web + worker + Postgres internally
- The Docker `web` container is bound to `127.0.0.1:3000` only —
  reachable from host Nginx but NOT from the public internet directly

> ⚠️ This droplet hosts other production sites. The host-level Nginx
> owns ports 80 and 443. We deliberately do NOT run Caddy here — it
> would conflict and break the other domains. SSL termination happens
> on the host's Nginx via Certbot.

---

## Phase 0 — Prerequisites checklist

Before you start, you should have:

- [ ] A DigitalOcean droplet running Ubuntu 22.04 with **≥ 2 GB RAM**
- [ ] SSH access to the droplet as `root` (or a sudo user)
- [ ] The droplet's public IP address handy
- [ ] DNS A record `mia.agenciarok.es` → droplet IP, already propagating
- [ ] Host Nginx already running and serving other domains
  (verify with `sudo nginx -T | grep server_name`)
- [ ] Certbot already installed (`certbot --version`); if not, the
  guide installs it
- [ ] A GitHub account and a private repo for the Deskia source code

---

## Phase 1 — Push the code to GitHub

```powershell
# From your dev machine, inside c:\rok\deskia
git init
git add .
git commit -m "Initial commit"

# Create a PRIVATE repo on GitHub via UI (https://github.com/new),
# then add it as origin:
git remote add origin git@github.com:<your-user>/deskia.git
git push -u origin main
```

Double-check that `.env.local` and `.env.production` are NOT in the
commit — `git status` should show them as ignored. If you see them
listed, stop and fix `.gitignore` before pushing.

---

## Phase 2 — Verify DNS

DNS should already point to the droplet. Verify from any machine:

```powershell
nslookup mia.agenciarok.es
# should return your droplet IP
```

If DNS isn't ready, fix it before continuing — Certbot needs the
domain to resolve to obtain the SSL cert.

---

## Phase 3 — Prepare the droplet (Docker only — Nginx already exists)

SSH in:

```powershell
ssh root@<DROPLET_IP>
```

Confirm the host Nginx is already serving other domains:

```bash
sudo nginx -T | grep server_name
# Expected output includes things like:
#   server_name agenciarok.com.ar www.agenciarok.com.ar;
#   server_name agenciarok.es www.agenciarok.es;
#   server_name mia.agenciarok.es;        ← may or may not exist yet
#   server_name nieta.agenciarok.com.ar;
#   server_name somosporlaunc.com.ar www.somosporlaunc.com.ar;
```

**Do NOT stop or replace Nginx.** Other sites depend on it.

Install Docker + Compose plugin + git if not already present:

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg git

# Skip the Docker block below if `docker --version` already works.
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu jammy stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
docker --version
docker compose version
```

Install Certbot if not already present:

```bash
which certbot || apt install -y certbot python3-certbot-nginx
```

> Firewall note: do NOT change `ufw` rules unless you're certain about
> what's already configured for the other sites. The host's Nginx
> needs 80/443 open, which it presumably already has.

---

## Phase 4 — Clone + configure

```bash
cd ~
git clone git@github.com:<your-user>/deskia.git
cd deskia
```

Create the production env file:

```bash
cp .env.production.example .env.production
nano .env.production
```

Fill in real values:

- `OPENAI_API_KEY` — your key
- `POSTGRES_PASSWORD` — generate a strong one:
  ```bash
  openssl rand -base64 32
  ```
  Use it in **two places** in the file: the `POSTGRES_PASSWORD=` line
  AND inside the `DATABASE_URL=` connection string.
- `ACTIVE_BUSINESS_SLUG` — defaults to `dra-sofia-vazquez`, leave as-is.

Save (Ctrl+O, Enter, Ctrl+X).

---

## Phase 5 — Build and start the Docker stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes ~3–5 minutes (npm install + next build).

Verify the three containers are healthy:

```bash
docker compose -f docker-compose.prod.yml ps
```

You should see `deskia-web` (healthy on `127.0.0.1:3000`),
`deskia-worker` (no ports), `deskia-db` (no ports, internal).

Smoke-test the app from the droplet itself (it's bound to loopback,
so this only works ON the droplet — not from your laptop):

```bash
curl -I http://127.0.0.1:3000
# Expected: HTTP/1.1 200 OK
```

If you get `Connection refused`, check container logs:

```bash
docker compose -f docker-compose.prod.yml logs --tail=80 web
```

---

## Phase 6 — Run migrations + seed initial data

Apply Prisma migrations (production-safe; no prompts, no resets):

```bash
docker compose -f docker-compose.prod.yml exec web npx prisma migrate deploy
```

Seed the business config (Sofía + Lumen) from TS files:

```bash
docker compose -f docker-compose.prod.yml exec web npm run db:seed
```

Then index Sofía's website (so the chat has retrieval content):

```bash
curl -X POST http://127.0.0.1:3000/api/onboard \
  -H "Content-Type: application/json" \
  -d '{"slug":"dra-sofia-vazquez","name":"Vazquez Dermatología","websiteUrl":"https://drasofiavazquez.com.ar","industry":"medical","language":"es","bookingMode":"whatsapp_handoff"}'
```

If `dra-sofia-vazquez` already exists (because seed creates it), the
endpoint returns 409. Instead, get the source ID and trigger a reindex:

```bash
docker compose -f docker-compose.prod.yml exec db \
  psql -U deskia -d deskia -c 'SELECT id, url FROM "KnowledgeSource";'

curl -X POST http://127.0.0.1:3000/api/sources/<SOURCE_ID>/reindex
```

Watch the worker pick it up:

```bash
docker compose -f docker-compose.prod.yml logs -f worker
```

---

## Phase 7 — Configure host Nginx to proxy mia.agenciarok.es

This is the new public entrypoint. Create a server block file:

```bash
sudo nano /etc/nginx/sites-available/mia.agenciarok.es
```

Paste this:

```nginx
# /etc/nginx/sites-available/mia.agenciarok.es
#
# Reverse proxy for the Deskia app running in Docker on this droplet.
# Certbot will add the 443 SSL server block + an http→https redirect
# automatically on the next step.

server {
    listen 80;
    listen [::]:80;
    server_name mia.agenciarok.es;

    # Increase from default 1m so visitors can paste longer messages
    # if needed. The app itself clamps user messages to 800 chars.
    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Required for the AI SDK chat to stream tokens live.
        # Without this, Nginx buffers the entire response and only
        # flushes when finished — chat feels frozen until the end.
        proxy_buffering off;
        proxy_cache off;

        # Standard reverse-proxy headers so Next.js sees the real
        # client info instead of Nginx's loopback request.
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Allow Server-Sent Events / WebSocket-style upgrades.
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";

        # The chat route has maxDuration=30s; give it some headroom.
        proxy_read_timeout 90s;
        proxy_send_timeout 90s;
    }
}
```

Enable the site, test config, reload Nginx (DO NOT restart — reload
is zero-downtime for the other sites on this droplet):

```bash
sudo ln -s /etc/nginx/sites-available/mia.agenciarok.es \
           /etc/nginx/sites-enabled/mia.agenciarok.es

sudo nginx -t
# Expected: "syntax is ok" + "test is successful"

sudo systemctl reload nginx
```

Verify HTTP works (from your laptop or the droplet):

```bash
curl -I http://mia.agenciarok.es
# Expected: HTTP/1.1 200 OK (or 308/301 once Certbot adds the redirect)
```

---

## Phase 8 — SSL with Certbot

Have Certbot fetch a Let's Encrypt cert and patch the Nginx server
block to add HTTPS + auto-redirect:

```bash
sudo certbot --nginx -d mia.agenciarok.es
```

Choose option **2** when asked (redirect HTTP → HTTPS).

Verify:

```bash
curl -I https://mia.agenciarok.es
# Expected: HTTP/2 200
```

Also reconfirm http now redirects to https:

```bash
curl -I http://mia.agenciarok.es
# Expected: HTTP/1.1 301 Moved Permanently  → location https://mia.agenciarok.es/
```

Cert renews automatically via the existing Certbot systemd timer.
Check it:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

---

## Phase 9 — Final verification

In a browser, open: **https://mia.agenciarok.es**

You should see:
- The lock icon (SSL working)
- The chat UI with "Vazquez Dermatología" branding
- Mia greeting in Spanish

Try the rosacea question. It should answer using retrieved content in
~2 seconds and the response should **stream token by token** (proves
`proxy_buffering off` is working).

---

## Redeploying after code changes

From your dev machine:

```powershell
git add .
git commit -m "Whatever change"
git push
```

SSH to the droplet:

```bash
ssh root@<DROPLET_IP>
cd ~/deskia
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec web npx prisma migrate deploy  # only if schema changed
```

No Nginx restart needed for code-only changes — host Nginx is just
proxying the loopback port, which the new container takes over
seamlessly.

A "no-schema-change" redeploy takes ~1–2 minutes.

---

## Troubleshooting

### `curl http://127.0.0.1:3000` returns Connection refused

The web container isn't running or isn't bound to loopback. Check:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 web
```

Also confirm the port binding shows `127.0.0.1:3000->3000/tcp`
(NOT `0.0.0.0:3000`) in `docker compose ps`.

### Nginx says `nginx: [emerg] ... bind() to 0.0.0.0:80 failed`

Some other process is on port 80. Should NOT happen on this droplet
(host Nginx already owns it). If it does, something tried to start
Caddy or another web server — kill it.

### `https://mia.agenciarok.es` shows the wrong site

Most likely the `default_server` for Nginx is catching the request
before our server block. Check:

```bash
sudo nginx -T | grep -A 2 server_name | grep -B 2 mia
```

Confirm the symlink exists:

```bash
ls -la /etc/nginx/sites-enabled/mia.agenciarok.es
```

Then `sudo nginx -t && sudo systemctl reload nginx`.

### Chat works but responses arrive all-at-once instead of streaming

`proxy_buffering off` is missing or got removed from the server block.
Re-add it and reload Nginx.

### `Cannot connect to database`

```bash
docker compose -f docker-compose.prod.yml exec web sh -c 'echo $DATABASE_URL'
```

If empty or wrong, check `.env.production`. After editing, the
container needs **recreation** (not just restart) to pick up env file
changes:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate web worker
```

### Certbot fails on the ACME challenge

Most common: DNS hasn't propagated yet. Run:

```bash
dig +short mia.agenciarok.es
```

If it doesn't return the droplet IP, wait and retry.

### Worker not processing ingest jobs

```bash
docker compose -f docker-compose.prod.yml logs -f worker
```

Should show `[worker] Deskia ingest worker online.` and then poll
quietly. If it errors on Prisma, run `migrate deploy` again.

### See what's stored

```bash
docker compose -f docker-compose.prod.yml exec db psql -U deskia -d deskia
```

Inside psql: `\dt` to list tables, `SELECT count(*) FROM "Document";` etc.

### Backup the database

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U deskia deskia > backup-$(date +%F).sql
```

Restore:

```bash
cat backup-2026-05-17.sql | docker compose -f docker-compose.prod.yml exec -T db \
  psql -U deskia -d deskia
```

Run automatic backups via cron later — not in MVP.

---

## What's still TODO before going live with real customers

- [ ] Automated daily Postgres backup → off-droplet storage (S3 / Spaces)
- [ ] Monitoring (UptimeRobot ping on `https://mia.agenciarok.es`)
- [ ] Error tracking (Sentry, or just log shipping)
- [ ] Admin auth on `/api/leads`, `/api/conversations`, `/api/onboard`
  (currently open — fine for testing, NOT for production)
- [ ] Rate limiting on `/api/chat` (per IP)
- [ ] Embed widget + multi-tenant slug resolution (next sprint)
