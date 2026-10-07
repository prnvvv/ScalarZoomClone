# Frontend container for Cloud Run / GCP.
# Build context: repository root (so frontend/ is available).
FROM node:22-alpine AS builder

WORKDIR /app

# Build arguments mirror the env variables the app expects.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_STUN_SERVER=stun:stun.l.google.com:19302
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STUN_SERVER=$NEXT_PUBLIC_STUN_SERVER

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# Production image using Next.js standalone output.
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Cloud Run sets PORT; default to 3000 for local Docker runs.
ENV PORT=3000
EXPOSE $PORT

CMD ["node", "server.js"]
