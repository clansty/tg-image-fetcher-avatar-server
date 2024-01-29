FROM node:20-slim AS base

RUN rm -f /etc/apt/apt.conf.d/docker-clean; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  apt update && apt-get --no-install-recommends install -y \
    openssl

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml /app/

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store,sharing=locked pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store,sharing=locked pnpm install --frozen-lockfile
COPY tsconfig.json /app/
COPY src /app/src
COPY prisma /app/prisma
RUN pnpm exec prisma generate
RUN pnpm run build

FROM base

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY prisma /app/prisma
RUN pnpm exec prisma generate
COPY --from=build /app/build /app/build

CMD pnpm start
