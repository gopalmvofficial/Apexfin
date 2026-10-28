#!/usr/bin/env bash
# ==============================================================================
# ApexFin - Linux VPS Deployment Runbook (Ubuntu/Debian)
# Automated zero-downtime deployment script with PM2 and Nginx
# ==============================================================================

set -euo pipefail

echo "==> [1/4] Installing dependencies & preparing environment..."
npm ci --prefer-offline

echo "==> [2/4] Building Next.js 15 Standalone production bundle..."
npm run build

echo "==> [3/4] Copying static assets to standalone directory..."
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/

echo "==> [4/4] Starting / Reloading PM2 Cluster..."
if command -v pm2 &> /dev/null; then
    pm2 startOrReload ecosystem.config.cjs --update-env
    pm2 save
    echo "==> ApexFin successfully deployed and running on PM2 cluster!"
else
    echo "PM2 not found. Running directly with Node:"
    node .next/standalone/server.js
fi
