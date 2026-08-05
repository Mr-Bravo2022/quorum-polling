# ---- Quorum live polling: single-container build (frontend + backend) ----

# 1) Build the React frontend. The public broker + topic prefix are baked in at
#    build time (Vite inlines VITE_* env vars). Override with --build-arg.
FROM node:20-slim AS frontend
ARG VITE_MQTT_URL=wss://broker.emqx.io:8084/mqtt
ARG VITE_MQTT_TOPIC_PREFIX=quorum/solisjuan/polling
ENV VITE_MQTT_URL=$VITE_MQTT_URL
ENV VITE_MQTT_TOPIC_PREFIX=$VITE_MQTT_TOPIC_PREFIX
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# 2) Build the backend (TypeScript -> dist).
FROM node:20-slim AS backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build

# 3) Runtime image: backend + its prod deps + the built frontend assets.
FROM node:20-slim AS runtime
ENV NODE_ENV=production
ENV MQTT_URL=wss://broker.emqx.io:8084/mqtt
ENV MQTT_TOPIC_PREFIX=quorum/solisjuan/polling
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=backend /app/backend/dist ./dist
COPY --from=frontend /app/frontend/dist ../frontend/dist
EXPOSE 3001
CMD ["node", "dist/index.js"]
