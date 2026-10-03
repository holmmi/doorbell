FROM node:24.21-alpine3.24 AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY doorbell-backend/package.json doorbell-backend/package.json
COPY doorbell-frontend/package.json doorbell-frontend/package.json
RUN npm ci

COPY doorbell-frontend doorbell-frontend
RUN npm run build --workspace=doorbell-frontend

FROM nginx:1.31.6-alpine3.24

RUN apk add --no-cache curl

COPY --from=build /app/doorbell-frontend/dist /usr/share/nginx/html

EXPOSE 80
