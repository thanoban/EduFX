FROM node:20-alpine AS builder

WORKDIR /app

COPY client/package*.json ./client/

WORKDIR /app/client
RUN npm ci

WORKDIR /app
COPY client ./client
COPY shared ./shared

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SKIP_LOGIN
# Consumed by next.config rewrites() at build time to bake the same-origin
# /api/backend proxy destination into the route manifest.
ARG BACKEND_ORIGIN

WORKDIR /app/client

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SKIP_LOGIN=$NEXT_PUBLIC_SKIP_LOGIN
ENV BACKEND_ORIGIN=$BACKEND_ORIGIN

RUN if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then \
      echo "NEXT_PUBLIC_SUPABASE_URL is required for the frontend build." >&2; \
      exit 1; \
    fi \
    && if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then \
      echo "NEXT_PUBLIC_SUPABASE_ANON_KEY is required for the frontend build. Set GitHub secret SUPABASE_ANON_KEY." >&2; \
      exit 1; \
    fi \
    && if echo "$NEXT_PUBLIC_SUPABASE_ANON_KEY" | grep -q '^sb_secret_'; then \
      echo "Refusing to build frontend with a secret Supabase key. Use the anon public key for NEXT_PUBLIC_SUPABASE_ANON_KEY." >&2; \
      exit 1; \
    fi \
    && npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/client/public ./public
COPY --from=builder /app/client/.next/standalone ./
COPY --from=builder /app/client/.next/static ./.next/static

EXPOSE 3000

CMD ["sh", "-c", "node server.js"]
