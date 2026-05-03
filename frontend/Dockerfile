# Build stage
FROM oven/bun:latest as build-stage
WORKDIR /app

# Accept build arguments
ARG VITE_API_URL
ARG VITE_PRIVY_APP_ID

# Set them as environment variables so Vite can see them
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_PRIVY_APP_ID=$VITE_PRIVY_APP_ID

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Production stage
FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /app/dist /usr/share/nginx/html

# Cloud Run requires the container to listen on the $PORT environment variable
# We use sed to update the default Nginx config at runtime
CMD ["/bin/sh", "-c", "sed -i 's/80/'\"$PORT\"'/g' /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
