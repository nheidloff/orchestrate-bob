# Build stage
FROM node:20-bookworm-slim AS builder
RUN rm -f /etc/apt/sources.list.d/debian.sources && \
    echo "deb http://deb.debian.org/debian bookworm main" > /etc/apt/sources.list && \
    apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json tsconfig.json ./
# Use npm cache and install all dependencies (including dev for build)
RUN npm config set cache /tmp/npm-cache --global && \
    npm ci
COPY src ./src
RUN npm run build
ENV HF_HOME=/app/cache
RUN node dist/download-model.js

# Production dependencies stage
FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app
COPY package*.json ./
# Install only production dependencies (including optional deps needed by transformers)
RUN npm config set cache /tmp/npm-cache --global && \
    npm ci --only=production && \
    npm cache clean --force

# Production stage
FROM node:20-bookworm-slim AS runner
RUN rm -f /etc/apt/sources.list.d/debian.sources && \
    echo "deb http://deb.debian.org/debian bookworm main" > /etc/apt/sources.list && \
    apt-get update && apt-get install -y ripgrep tree jq && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Copy production dependencies from dedicated stage
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/cache /app/cache
COPY package*.json ./
# Copy the documentation files into the image
COPY documentation ./documentation

EXPOSE 3033
ENV PORT=3033
ENV DOCS_DIR=/app/documentation
ENV HF_HOME=/app/cache

CMD ["node", "dist/index.js"]
