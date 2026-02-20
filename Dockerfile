FROM node:18-slim

WORKDIR /app

# Install openssl and other dependencies for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source code
COPY src ./src

# Default environment variables
ENV PORT=3030
EXPOSE 3030

# Run migrations and then start the server
CMD npx prisma migrate deploy && node src/index.js
