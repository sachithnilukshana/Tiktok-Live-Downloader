# ── Stage 1: install Node dependencies ───────────────────────────────────────
FROM node:22-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
# Install only production deps; skip optional/dev to keep the layer small
RUN npm ci --omit=dev

# ── Stage 2: runtime image ───────────────────────────────────────────────────
FROM node:22-slim AS runtime

# Install FFmpeg from Debian repos (slim base still has apt)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Non-root user for security
RUN groupadd --gid 1001 recorder && \
    useradd  --uid 1001 --gid 1001 --no-create-home recorder

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY package.json ./
COPY src/ ./src/

# Writable directories: recordings buffer and persistent state
RUN mkdir -p /data/recordings /data/state && \
    chown -R recorder:recorder /app /data

USER recorder

# Render / Kubernetes health-check: expose the HTTP probe on 8080
EXPOSE 8080

# Point the app at the Docker-managed volumes
ENV RECORDINGS_DIR=/data/recordings \
    STATE_DIR=/data/state \
    PORT=8080 \
    FFMPEG_PATH=ffmpeg \
    NODE_ENV=production

CMD ["node", "src/index.js"]
