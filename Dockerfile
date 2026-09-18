# syntax=docker/dockerfile:1.7
# mootech-fe — the Next 14 (Pages Router) app Vercel serves today, as a reproducible standalone image
# (mumate-infra-move-001 slice 1). Replaces the 2025 Dockerfile that COPYed `.env.${NODE_ENV}` into the image.
#
#   • Base pinned by digest to node:22, Debian slim (glibc, like Vercel's runtime).
#   • `next build` runs with NEXT_OUTPUT_STANDALONE=1 (next.config.mjs) — the Vercel build is untouched.
#   • BUILD ARGUMENTS ARE THE PUBLIC VALUES NEXT INLINES AT BUILD TIME and nothing else: NEXT_PUBLIC_* (client
#     bundle) and NEXTAUTH_URL / ENVIRONMENT / HOST (next.config.mjs publicRuntimeConfig — the v1 refer link is
#     built from NEXTAUTH_URL). The same values are set on Vercel at build time today. None is a secret; every
#     secret (DATABASE_URL, NEXTAUTH_SECRET, …) reaches the process only through the runtime environment.
#   • The repo's postbuild gates still run inside the build: check-vapid-not-leaked.sh (placeholder tracer, must
#     be ABSENT from the bundle) and check-omise-key-inlined.sh (if NEXT_PUBLIC_OMISE_KEY_V2 is given it must be
#     PRESENT; with no key and no CI/VERCEL env it skips LOUDLY — read the build log).
#   • No env file is ever COPYed (.dockerignore). APP_GIT_SHA names the built revision through /api/health.
#
# Build:  docker build --build-arg APP_GIT_SHA=$(git rev-parse HEAD) --build-arg NEXTAUTH_URL=https://… \
#           --build-arg NEXT_PUBLIC_BACKEND_URL=https://… [--build-arg NEXT_PUBLIC_OMISE_KEY_V2=pkey_…] -t mootech-fe:local .
# Smoke:  bash scripts/container-smoke.sh   (builds, hygiene, /api/health db, maintenance gate on the image)

ARG BASE=node:22.23.2-bookworm-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5

# ── deps ──────────────────────────────────────────────────────────────────────────────────────────────────────
FROM ${BASE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts/install-git-hooks.sh ./scripts/install-git-hooks.sh
RUN npm ci --no-audit --no-fund

# ── builder ───────────────────────────────────────────────────────────────────────────────────────────────────
FROM ${BASE} AS builder
WORKDIR /app
ARG NEXTAUTH_URL=http://localhost:3000
ARG ENVIRONMENT=production
ARG HOST=
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
ARG NEXT_PUBLIC_OMISE_KEY=
ARG NEXT_PUBLIC_OMISE_KEY_V2=
ARG NEXT_PUBLIC_ENABLE_CHAT=
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=
ARG NEXT_PUBLIC_WHATIF_API_URL=
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT_STANDALONE=1 \
    NEXTAUTH_URL=${NEXTAUTH_URL} \
    ENVIRONMENT=${ENVIRONMENT} \
    HOST=${HOST} \
    NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL} \
    NEXT_PUBLIC_OMISE_KEY=${NEXT_PUBLIC_OMISE_KEY} \
    NEXT_PUBLIC_OMISE_KEY_V2=${NEXT_PUBLIC_OMISE_KEY_V2} \
    NEXT_PUBLIC_ENABLE_CHAT=${NEXT_PUBLIC_ENABLE_CHAT} \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=${NEXT_PUBLIC_VAPID_PUBLIC_KEY} \
    NEXT_PUBLIC_WHATIF_API_URL=${NEXT_PUBLIC_WHATIF_API_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runner ────────────────────────────────────────────────────────────────────────────────────────────────────
FROM ${BASE} AS runner
ARG APP_GIT_SHA=unknown
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    APP_GIT_SHA=${APP_GIT_SHA} \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
