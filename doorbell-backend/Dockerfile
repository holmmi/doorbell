FROM node:24.21-alpine3.24 AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY doorbell-backend/package.json doorbell-backend/package.json
COPY doorbell-frontend/package.json doorbell-frontend/package.json
RUN npm ci

COPY doorbell-backend doorbell-backend
RUN npm run build --workspace=doorbell-backend

FROM node:24.21-alpine3.24

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json package-lock.json ./
COPY doorbell-backend/package.json doorbell-backend/package.json
COPY doorbell-frontend/package.json doorbell-frontend/package.json
RUN npm ci --omit=dev --workspace=doorbell-backend --include-workspace-root=false

COPY --from=build /app/doorbell-backend/dist doorbell-backend/dist

EXPOSE 8001

CMD ["node", "doorbell-backend/dist/index.js"]
