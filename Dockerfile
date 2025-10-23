FROM node:20-bookworm-slim AS app

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build static assets
COPY . .
RUN npm run build

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# Run the TypeScript entry point via tsx's loader
CMD ["node", "--loader", "tsx/loader", "src/index.ts"]
