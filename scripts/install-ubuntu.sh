#!/usr/bin/env bash
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Run with sudo: sudo bash scripts/install-ubuntu.sh"; exit 1; fi
apt-get update
apt-get install -y ca-certificates curl ffmpeg xz-utils
if ! command -v node >/dev/null || [[ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 22 ]]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi
id -u tiktokrec >/dev/null 2>&1 || useradd --system --create-home --home-dir /opt/tiktok-live-auto-recorder --shell /usr/sbin/nologin tiktokrec
mkdir -p /opt/tiktok-live-auto-recorder
cp -a . /opt/tiktok-live-auto-recorder/
cd /opt/tiktok-live-auto-recorder
npm install --omit=dev
mkdir -p data recordings
chown -R tiktokrec:tiktokrec /opt/tiktok-live-auto-recorder
install -m 0644 deploy/tiktok-recorder.service /etc/systemd/system/tiktok-recorder.service
systemctl daemon-reload
echo "Installed. Configure /opt/tiktok-live-auto-recorder/.env, then run:"
echo "  sudo systemctl enable --now tiktok-recorder"
