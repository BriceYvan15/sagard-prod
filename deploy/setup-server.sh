#!/bin/bash
set -e

echo "══════════════════════════════════════════════"
echo "  SAGARD SÉCURITÉ — Server Setup"
echo "══════════════════════════════════════════════"

# ── 1. Create directory structure ──
echo "► Creating directories..."
mkdir -p /opt/sagard/{api,frontend,deploy}

# ── 2. Install pnpm if needed ──
if ! command -v pnpm &>/dev/null; then
  echo "► Installing pnpm..."
  npm install -g pnpm
fi

# ── 3. Install pm2 if needed ──
if ! command -v pm2 &>/dev/null; then
  echo "► Installing pm2..."
  npm install -g pm2
fi

# ── 4. Start database containers ──
echo "► Starting PostgreSQL & Redis..."
cd /opt/sagard/deploy
docker compose -f docker-compose.prod.yml up -d

echo "► Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
  if docker exec sagard-postgres pg_isready -U sagard -d sagard_db &>/dev/null; then
    echo "  PostgreSQL is ready!"
    break
  fi
  sleep 2
done

echo "══════════════════════════════════════════════"
echo "  Infrastructure ready!"
echo "══════════════════════════════════════════════"
