# Multi-stage build for webclient-document-upload
# Stage 1: Build frontend
FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy frontend source
COPY . .

# Build frontend
RUN npm run build

# Stage 2: Setup backend with Python support
FROM node:20-bookworm-slim AS production

# Install Python and required system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    gcc \
    g++ \
    make \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/archives/* /tmp/* /root/.cache

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy server code
COPY tsconfig.json ./
COPY tsconfig.server.json ./
COPY src ./src

# Copy and install Python dependencies
COPY requirements.txt ./
RUN pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu --break-system-packages --no-cache-dir && \
    pip3 install transformers pymupdf python-pptx python-docx --break-system-packages --no-cache-dir && \
    rm -rf /root/.cache /tmp/*

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p /app/uploads && chmod 777 /app/uploads

# Expose backend port
EXPOSE 3001

# Set Python path environment variable
ENV PYTHON_PATH=/usr/bin/python3
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start the application
CMD ["npm", "run", "server"]
