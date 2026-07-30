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

# Python is retained for the Owl & Compass backend package. A virtual
# environment avoids the system Python's externally-managed-package policy.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies and source package (from pyproject.toml and src/)
COPY pyproject.toml .
COPY src/ ./src
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir .

# Copy the self-contained Next.js server and its runtime assets.
COPY --from=frontend-builder /app/web/.next/standalone ./
COPY --from=frontend-builder /app/web/.next/static ./.next/static
COPY --from=frontend-builder /app/web/public ./public

# Railway routes requests to the Next.js server on $PORT.
EXPOSE 3000

# Environment defaults (can be overridden by Railway variables)
ENV NODE_ENV=production
ENV PORT=3000
ENV PATH="/opt/venv/bin:${PATH}"

# Start the frontend. The FastAPI service has not yet been added; once it is
# implemented, it can be started as a sidecar here.
COPY <<'EOF' /app/entrypoint.sh
#!/bin/sh
exec node server.js
EOF
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
