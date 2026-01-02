# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create uploads directory if it doesn't exist
RUN mkdir -p src/uploads

# Expose port (Cloud Run uses PORT env var, defaults to 8080)
EXPOSE 8080

# Start the application
CMD ["node", "app.js"]

