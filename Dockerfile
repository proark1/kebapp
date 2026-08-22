# syntax=docker/dockerfile:1.7

FROM node:24.13.0-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.19.0 --activate

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS source

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

FROM source AS tooling

ENV NODE_ENV=production
CMD ["pnpm", "prod:migrate"]

FROM source AS builder

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://kebapp_app:build-only@127.0.0.1:5432/kebapp
ENV BETTER_AUTH_SECRET=build-only-secret-with-at-least-32-characters
ENV BETTER_AUTH_URL=https://127-0-0-1.sslip.io
ENV DEMO_MODE=true

RUN mkdir -p public && pnpm build

# Next 16 traces only the CJS branch of this export-mapped pnpm dependency,
# while the standalone server loads its ESM branch during startup.
RUN HELPER_PACKAGE="$(find node_modules/.pnpm -maxdepth 1 -type d -name '@swc+helpers@*' -print -quit)" \
    && test -n "$HELPER_PACKAGE" \
    && HELPER_TARGET=".next/standalone/node_modules/.pnpm/$(basename "$HELPER_PACKAGE")/node_modules/@swc/helpers" \
    && mkdir -p "$HELPER_TARGET" \
    && cp -a "$HELPER_PACKAGE/node_modules/@swc/helpers/." "$HELPER_TARGET/"

FROM node:24.13.0-alpine AS app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
