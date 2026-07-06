# Multi-stage build for full-stack Node.js Express + React/Vite application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including devDependencies)
COPY package*.json ./
RUN npm ci

# Copy the entire workspace to build the production bundle
COPY . .

# Run the production build.
# This compiles the React frontend to dist/ and bundles server.ts into dist/server.cjs
RUN npm run build

# Production-ready thin image
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files and runtime databases/assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/inventory ./inventory
COPY --from=builder /app/cve_sources.json ./cve_sources.json
COPY --from=builder /app/scan_settings.json ./scan_settings.json
COPY --from=builder /app/users.json ./users.json

# Expose port 3000 (standard port for the server.ts Express endpoint)
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start the bundled Express server
CMD ["npm", "run", "start"]
