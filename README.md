<div align="center">

# 📹 TikTok LIVE Auto Recorder

**Automatically detect, record, and archive TikTok LIVE streams — controlled entirely from Telegram.**

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-latest-007808?logo=ffmpeg&logoColor=white)](https://ffmpeg.org)
[![Backblaze B2](https://img.shields.io/badge/Storage-Backblaze%20B2-E03C31?logo=backblaze&logoColor=white)](https://www.backblaze.com/cloud-storage)
[![Telegram Bot](https://img.shields.io/badge/Telegram-Bot-26A5E4?logo=telegram&logoColor=white)](https://core.telegram.org/bots)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> Monitor any public TikTok creator. The moment they go LIVE, FFmpeg starts recording. When the stream ends, the file uploads automatically to Backblaze B2 and you get a private download link in Telegram — all without touching a server.

</div>

---

## ✨ Features

| | |
|---|---|
| 🤖 **Telegram-first control** | Add/remove creators, check status, fetch links — all via chat commands |
| 🔴 **Auto LIVE detection** | Polls TikTok every N seconds; starts recording the moment a stream opens |
| 🎬 **Zero-transcode recording** | FFmpeg stream-copies HLS/FLV → `.mkv` — no quality loss, low CPU |
| ☁️ **Backblaze B2 upload** | Multipart upload; local file deleted after confirmed B2 write |
| 🔗 **Private presigned links** | 7-day download URLs sent directly to your Telegram chat |
| 🔁 **Auto-restart** | systemd service (VPS) or Docker restart policy keeps it running 24/7 |
| 🐳 **Docker / Render ready** | Single-command deploy on any server or Render.com |
| 🔒 **Hardened by default** | Non-root user, private bucket, bucket-scoped keys, no open ports |
| 🏥 **HTTP health endpoint** | `GET /health` for Render health-checks and uptime monitors |

---

## 🏗 Architecture

```
  You ──▶ Telegram Bot
              │
     ┌────────┴─────────┐
     │  Node.js Process  │
     │  ┌─────────────┐  │
     │  │  Monitor    │──┼──▶ TikTok LIVE API (poll every 45 s)
     │  │  (setInterval)│  │
     │  └──────┬──────┘  │
     │         │ LIVE!   │
     │  ┌──────▼──────┐  │
     │  │   FFmpeg    │──┼──▶ HLS / FLV stream
     │  │  (stream    │  │       │
     │  │   copy)     │  │       ▼
     │  └──────┬──────┘  │  /data/recordings/*.mkv
     │         │ done    │
     │  ┌──────▼──────┐  │
     │  │  B2 Upload  │──┼──▶ Backblaze B2 (private bucket)
     │  └──────┬──────┘  │
     └─────────┼─────────┘
               │ presigned URL
               ▼
           Telegram DM 📲
```

---

## 📋 Prerequisites

- **A Telegram bot token** — create one with [@BotFather](https://t.me/BotFather)
- **Your numeric Telegram user ID** — get it from [@userinfobot](https://t.me/userinfobot)
- **A private Backblaze B2 bucket** with a bucket-scoped app key

Then choose your deployment method:

| Method | Best for |
|--------|----------|
| 🐳 Docker Compose | Oracle Cloud VPS / any Linux server |
| ☁️ Render.com | Managed cloud, zero server config |
| 🖥️ systemd (bare-metal) | Full control on Ubuntu 22.04/24.04 |

---

## ⚙️ Configuration

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
nano .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | ✅ | — | Token from @BotFather |
| `TELEGRAM_ALLOWED_USER_ID` | ✅ | — | Your numeric Telegram user ID |
| `B2_ENDPOINT` | ✅ | — | e.g. `https://s3.us-west-004.backblazeb2.com` |
| `B2_REGION` | ✅ | `us-west-004` | Must match your bucket's region |
| `B2_BUCKET` | ✅ | — | Your private bucket name |
| `B2_ACCESS_KEY_ID` | ✅ | — | Backblaze app key ID |
| `B2_SECRET_ACCESS_KEY` | ✅ | — | Backblaze app key secret |
| `B2_LINK_EXPIRY_SECONDS` | | `604800` | Presigned URL lifetime (max 7 days) |
| `B2_PREFIX` | | `live-recordings` | Object key prefix in the bucket |
| `POLL_INTERVAL_SECONDS` | | `45` | How often to check if a creator is LIVE |
| `OFFLINE_CONFIRMATIONS` | | `2` | Consecutive offline polls before stopping |
| `MAX_CONCURRENT_RECORDINGS` | | `2` | Max simultaneous recordings |
| `RECORDINGS_DIR` | | `./recordings` | Temporary local recording directory |
| `FFMPEG_PATH` | | `ffmpeg` | Path to FFmpeg binary |

> **Security:** Never commit `.env` to git. The `.gitignore` already excludes it.

---

## 🐳 Deploy with Docker (Recommended — Oracle VPS / any server)

### Quick start

```bash
# 1. Clone the repo
git clone https://github.com/sachithnilukshana/Tiktok-Live-Downloader.git
cd Tiktok-Live-Downloader

# 2. Configure
cp .env.example .env
nano .env   # fill in your secrets

# 3. Build and run (detached)
docker compose up -d --build

# 4. Verify it's healthy
curl http://localhost:8080/health
```

### Health check response

```json
{
  "status": "ok",
  "uptime": 3600,
  "monitored": 2,
  "activeRecordings": 1,
  "recordings": ["creator_username"],
  "timestamp": "2026-11-26T00:00:00.000Z"
}
```

### Useful Docker commands

```bash
# View live logs
docker compose logs -f

# Restart after editing .env
docker compose restart

# Stop everything
docker compose down

# Check disk usage of the data volume
docker system df -v
```

---

## ☁️ Deploy on Render.com

This repo ships a `render.yaml` Blueprint — Render reads it automatically.

1. **Fork / push** this repo to your GitHub account.
2. In the Render dashboard → **New → Blueprint** → connect your repo.
3. Render provisions the web service + a **5 GB persistent disk** at `/data`.
4. In the **Environment** tab, add the five secrets:

   | Secret | Value |
   |--------|-------|
   | `TELEGRAM_BOT_TOKEN` | from @BotFather |
   | `TELEGRAM_ALLOWED_USER_ID` | your numeric ID |
   | `B2_BUCKET` | bucket name |
   | `B2_ACCESS_KEY_ID` | key ID |
   | `B2_SECRET_ACCESS_KEY` | key secret |

5. Click **Save** — Render builds the Docker image and starts the service.

> **Tip:** Use the **Starter ($7/mo)** plan or higher for guaranteed 24/7 uptime.  
> The free tier sleeps after inactivity.

---

## 🖥️ Deploy on Ubuntu VPS (systemd)

Tested on Ubuntu 22.04 and 24.04. Run from the project root:

```bash
# 1. Upload project to your VPS (from your local machine)
scp -r . ubuntu@<your-vps-ip>:~/tiktok-live-auto-recorder

# 2. SSH into your VPS
ssh ubuntu@<your-vps-ip>
cd ~/tiktok-live-auto-recorder

# 3. Install dependencies + create systemd service
chmod +x scripts/install-ubuntu.sh
sudo bash scripts/install-ubuntu.sh

# 4. Add your secrets
sudo nano /opt/tiktok-live-auto-recorder/.env
sudo chown tiktokrec:tiktokrec /opt/tiktok-live-auto-recorder/.env
sudo chmod 600 /opt/tiktok-live-auto-recorder/.env

# 5. Enable and start
sudo systemctl enable --now tiktok-recorder
sudo systemctl status tiktok-recorder
```

### Useful systemd commands

```bash
# Live logs
sudo journalctl -u tiktok-recorder -f

# Restart after config change
sudo systemctl restart tiktok-recorder

# Stop the service
sudo systemctl stop tiktok-recorder
```

The installer:
- Installs **Node.js 22** (via NodeSource) and **FFmpeg** automatically
- Creates a locked-down `tiktokrec` system user
- Copies the project to `/opt/tiktok-live-auto-recorder`
- Installs the **systemd service** with security hardening (`NoNewPrivileges`, `PrivateTmp`, `ProtectSystem`, etc.)

---

## 🤖 Telegram Bot Commands

Once the bot is running, control everything from Telegram:

| Command | Description |
|---------|-------------|
| `/add username` | ➕ Start monitoring a TikTok creator |
| `/remove username` | ➖ Stop monitoring (finalizes active recording) |
| `/list` | 👥 List all monitored creators |
| `/status` | 📡 Show active recordings & polling info |
| `/recordings` | 🎞 Last 10 uploads with B2 download links |
| `/stop username` | ⏹ Force-stop & upload an active recording |
| `/help` | ❓ Show command reference |

### Example flow

```
You:  /add ns.raven_15
Bot:  ✅ Monitoring @ns.raven_15

[45 seconds later — creator goes LIVE]

Bot:  🔴 TikTok LIVE detected!
      Creator: @ns.raven_15
      Room ID: 7441234567890
      Status: Recording started

[Creator ends stream]

Bot:  ⏹ Recording finished
      Creator: @ns.raven_15
      Size: 847.32 MB
      Uploading to Backblaze B2...

Bot:  ☁️ Recording uploaded successfully!
      Creator: @ns.raven_15
      Size: 847.32 MB
      Download link:
      https://s3.us-west-004.backblazeb2.com/...
      Link expires in 168 hours.
```

---

## 🔧 Local Development

```bash
# Requires Node.js 22+ and FFmpeg installed locally
npm install
npm run check    # syntax check all source files
npm start
```

Then send `/add someone` in Telegram to test.

---

## 🔍 Troubleshooting

<details>
<summary><strong>Missing required environment variable</strong></summary>

Check `.env` exists and all required keys are set.  
On systemd: confirm `/opt/tiktok-live-auto-recorder/.env` is readable by the `tiktokrec` user.

```bash
sudo -u tiktokrec cat /opt/tiktok-live-auto-recorder/.env
```
</details>

<details>
<summary><strong>B2 403 / AccessDenied</strong></summary>

- Confirm the app key is scoped to the correct bucket with **read & write** access
- Verify `B2_ENDPOINT`, `B2_REGION`, `B2_BUCKET`, `B2_ACCESS_KEY_ID`, and `B2_SECRET_ACCESS_KEY` all match the Backblaze console exactly
- Region and endpoint must match (e.g. `us-west-004` ↔ `s3.us-west-004.backblazeb2.com`)
</details>

<details>
<summary><strong>ffmpeg: not found</strong></summary>

```bash
# Ubuntu / Debian
sudo apt install ffmpeg

# Docker: FFmpeg is installed in the image automatically
# Custom path: set FFMPEG_PATH=/usr/local/bin/ffmpeg in .env
```
</details>

<details>
<summary><strong>TikTok check errors / rate limiting</strong></summary>

- Increase `POLL_INTERVAL_SECONDS` to `60`–`120`
- Run `npm update tiktok-live-connector` — TikTok occasionally changes endpoints
- An API/network error is **not** treated as offline. The stream will only stop after `OFFLINE_CONFIRMATIONS` consecutive confirmed-offline polls.
</details>

<details>
<summary><strong>Disk space issues</strong></summary>

```bash
# Check free space
df -h

# Check recording directory
du -sh /data/recordings          # Docker
du -sh /opt/tiktok-live-auto-recorder/recordings   # systemd

# Recordings are deleted automatically after a successful B2 upload.
# If a recording is stuck (upload failed), its path is sent to Telegram.
```
</details>

<details>
<summary><strong>LIVE detected but no stream URL returned</strong></summary>

TikTok may restrict HLS/FLV access from certain IP ranges (datacenters).  
Try with a residential or cloud provider IP, or use a VPN/proxy exit node in a supported region.
</details>

---

## 🔒 Security Checklist

- [x] `.env` is in `.gitignore` — never committed
- [x] Use a **private** B2 bucket
- [x] Create a **bucket-scoped** app key — no account-wide permissions
- [x] Bot checks both sender ID and chat ID — unauthorized users get `⛔ Not authorized`
- [x] systemd service runs as `tiktokrec` (unprivileged system user) with `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem`
- [x] Docker image runs as a non-root `recorder` user (UID 1001)
- [x] No inbound ports opened beyond the health-check endpoint (internal use only)
- [x] Use SSH key authentication on your VPS; disable password login
- [ ] Rotate B2 and Telegram credentials immediately if accidentally exposed

---

## 📁 Project Structure

```
tiktok-live-auto-recorder/
├── src/
│   ├── index.js        # Entry point — wires all modules together
│   ├── config.js       # Validated environment variable loader
│   ├── bot.js          # Telegram bot & command handlers
│   ├── monitor.js      # LIVE detection & recording lifecycle
│   ├── recorder.js     # FFmpeg process management
│   ├── storage.js      # Backblaze B2 upload & presigned URLs
│   ├── state.js        # JSON state persistence (creators + history)
│   └── health.js       # HTTP health-check server (GET /health)
├── scripts/
│   └── install-ubuntu.sh   # One-shot Ubuntu VPS installer
├── deploy/
│   └── tiktok-recorder.service  # systemd unit file
├── Dockerfile              # Multi-stage Docker build (Node 22 + FFmpeg)
├── docker-compose.yml      # Local / VPS Docker Compose stack
├── render.yaml             # Render.com Blueprint
├── .env.example            # Environment variable template
└── package.json
```

---

## 🤝 Contributing

Pull requests are welcome! Please open an issue first to discuss major changes.

```bash
git checkout -b feature/your-idea
# make changes
git commit -m "feat: your idea"
git push origin feature/your-idea
# open a PR on GitHub
```

---

## ⚠️ Legal & Ethical Notice

> This tool is intended **only** for creators or platforms you have permission to record.  
> - Respect [TikTok's Terms of Service](https://www.tiktok.com/legal/page/global/terms-of-service/en)  
> - Respect copyright, privacy, and applicable law in your jurisdiction  
> - `tiktok-live-connector` is an **unofficial** library; TikTok can change or block its endpoints at any time  
> - This project does **not** bypass DRM, private accounts, access controls, or paid content

---

## 📄 License

[MIT](LICENSE) — free to use, modify, and distribute.

---

<div align="center">

Made with ❤️ · Star ⭐ this repo if it helped you!

</div>
