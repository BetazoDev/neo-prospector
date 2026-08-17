# Single-stage build — avoids the multi-stage node_modules / generated Prisma client issue
FROM node:22-alpine

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Install ALL dependencies (prod + dev needed for Prisma CLI and Next.js build)
COPY package.json package-lock.json* ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client (dummy URL — no real DB needed at build time)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Build Next.js
RUN npm run build

# Runtime env
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

# startup.js: starts server.js immediately and syncs DB schema in background
CMD ["node", "startup.js"]
