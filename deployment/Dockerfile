FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/api apps/api
COPY apps/web apps/web
RUN npm run build

FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --ignore-scripts --workspace @mayoristapro/api --include-workspace-root
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/src/workers apps/api/src/workers
COPY database database
COPY deployment/start.cjs deployment/start.cjs
USER node
CMD ["node", "deployment/start.cjs", "api"]

FROM nginx:1.28-alpine AS web
ENV WEB_PORT=8080 API_HOST=api API_PORT=3000
COPY --from=build /app/apps/web/dist/catalog/browser /usr/share/nginx/html
COPY deployment/nginx.conf.template /etc/nginx/templates/default.conf.template
EXPOSE 8080
