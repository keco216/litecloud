FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production

FROM node:20-alpine
RUN apk add --no-cache sqlite vips-dev
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/drizzle ./drizzle

ENV NODE_ENV=production
ENV UPLOAD_DIR=/data/uploads
ENV DB_PATH=/data/litecloud.db
ENV BODY_SIZE_LIMIT=Infinity
ENV ORIGIN=http://localhost:3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

EXPOSE 3000
CMD ["node", "build"]
