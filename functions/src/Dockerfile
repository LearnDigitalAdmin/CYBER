# Use Node.js 18 LTS
FROM node:18-slim

# Install dependencies for Sharp and ImageMagick
RUN apt-get update && apt-get install -y \
    imagemagick \
    ghostscript \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Fix ImageMagick security policy to allow PDF operations
RUN sed -i 's/<policy domain="coder" rights="none" pattern="PDF" \/>/<policy domain="coder" rights="read|write" pattern="PDF" \/>/g' /etc/ImageMagick-6/policy.xml

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]