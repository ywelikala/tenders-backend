# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001

# Create directories for uploads and logs
RUN mkdir -p uploads/profiles uploads/tenders logs && \
    chown -R nodeuser:nodejs uploads logs

# Copy application code
COPY --chown=nodeuser:nodejs . .

# Remove development files and secrets
RUN rm -rf tests/ coverage/ *.test.js migrate-to-atlas.js simple-migration.js \
    working-migration.js verify-migration.js test-atlas-connection.js \
    debug-connection.js ATLAS_SETUP_GUIDE.md .env .env.stripe.example \
    STRIPE_INTEGRATION.md GCP_DEPLOYMENT_GUIDE.md

# Switch to non-root user
USER nodeuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start application
CMD ["npm", "start"]