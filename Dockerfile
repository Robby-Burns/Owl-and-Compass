# -------------------------------------------------
# Stage 1 – Build the Next.js frontend
# -------------------------------------------------
FROM node:22-alpine AS frontend-builder
WORKDIR /app/web

# Install dependencies (uses lockfile if present)
COPY web/package*.json ./
RUN npm ci

# Copy source and build
COPY web/ ./
RUN npm run build   # creates .next, .next/static, etc.

# -------------------------------------------------
# Stage 2 – Runtime image (Node.js + Python package)
# -------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# Install Python, system libraries for Playwright Chromium, and virtual environment
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-venv \
        libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
        libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
        libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies and source package (from pyproject.toml and src/)
COPY pyproject.toml .
COPY src/ ./src
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir . \
    && (/opt/venv/bin/python3 -m playwright install chromium || echo "WARN: Playwright Chromium install bypassed")

# Copy the self-contained Next.js server and its runtime assets.
COPY --from=frontend-builder /app/web/.next/standalone ./
COPY --from=frontend-builder /app/web/.next/static ./.next/static
COPY --from=frontend-builder /app/web/public ./public

# Railway routes requests to the Next.js server on $PORT.
EXPOSE 3000

# Environment defaults (can be overridden by Railway variables)
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV PATH="/opt/venv/bin:${PATH}"

# Start the frontend listening on 0.0.0.0:$PORT for Railway
COPY <<'EOF' /app/entrypoint.sh
#!/bin/sh
export HOSTNAME="0.0.0.0"
export PORT="${PORT:-3000}"
exec node server.js
EOF
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
