FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY preinstall.mjs ./
COPY lib/ lib/
COPY artifacts/api-server/ artifacts/api-server/

RUN npm install -g pnpm && pnpm install --frozen-lockfile --ignore-scripts
RUN pnpm --filter @workspace/api-server run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "--import", "./artifacts/api-server/dist/env.mjs", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
