# Use Node.js 18 base image
FROM node:18-bullseye

# Install system dependencies for Sharp, ImageMagick, and Ghostscript
RUN apt-get update && apt-get install -y \
    imagemagick \
    ghostscript \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Configure ImageMagick policy to allow PDF operations
RUN sed -i 's/<policy domain="coder" rights="none" pattern="PDF" \/>/<policy domain="coder" rights="read|write" pattern="PDF" \/>/g' /etc/ImageMagick-6/policy.xml

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy application code
COPY . .

# Build TypeScript using npx to ensure proper execution
RUN npx tsc

# Remove devDependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Start the server
CMD ["node", "dist/server.js"]