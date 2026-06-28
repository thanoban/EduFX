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

WORKDIR /app/client

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SKIP_LOGIN=$NEXT_PUBLIC_SKIP_LOGIN

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/client/public ./public
COPY --from=builder /app/client/.next/standalone ./
COPY --from=builder /app/client/.next/static ./.next/static

EXPOSE 3000

CMD ["sh", "-c", "node server.js"]
