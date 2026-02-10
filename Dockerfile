# Use Node.js 18 LTS (full image to ensure all build tools are available)
FROM node:18

# Set working directory
WORKDIR /app

# Copy package files (only package.json to avoid lock file issues)
COPY package.json ./

# Install dependencies - workaround for npm bug with optional dependencies
# Remove any existing lock file and node_modules, then install fresh
# This ensures optional dependencies like @rollup/rollup-linux-x64-gnu are installed
RUN rm -rf node_modules package-lock.json && \
    npm install

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Expose port (Cloud Run will set PORT env var)
EXPOSE 8080

# Set qa/deployed environment
ENV NODE_ENV=qa

# Start the server
CMD ["npm", "start"]
