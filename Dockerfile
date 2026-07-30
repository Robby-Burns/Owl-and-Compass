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
# Stage 2 – Runtime image (Python + compiled UI)
# -------------------------------------------------
FROM python:3.12-slim AS runtime

# Install OS packages required by psycopg2 (Postgres driver)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Python dependencies and source package (from pyproject.toml and src/)
COPY pyproject.toml .
COPY src/ ./src
RUN pip install --no-cache-dir .

# Copy compiled Next.js assets from the builder
COPY --from=frontend-builder /app/web/.next ./.next
COPY --from=frontend-builder /app/web/public ./public
COPY --from=frontend-builder /app/web/next.config.mjs ./next.config.mjs
COPY --from=frontend-builder /app/web/package*.json ./
COPY --from=frontend-builder /app/web/.next/standalone ./

# Expose ports (Railway will expose only $PORT; we bind both services to it)
EXPOSE 3000 8000

# Environment defaults (can be overridden by Railway variables)
ENV NODE_ENV=production
ENV PORT=3000

# Entrypoint runs both services concurrently
COPY <<'EOF' /app/entrypoint.sh
#!/bin/sh
# Start FastAPI in background
uvicorn src.main:app --host 0.0.0.0 --port 8000 &
# Start Next.js server (it will listen on $PORT)
npx next start -p ${PORT:-3000}
wait
EOF
RUN chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
