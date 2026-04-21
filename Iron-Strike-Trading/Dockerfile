# ---- Build stage ----
FROM public.ecr.aws/docker/library/node:20 AS build
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy all source
COPY . .

# ----- Vite build-time env vars -----
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Build client + server (your existing build script)
RUN npm run build

# ---- Runtime stage ----
FROM public.ecr.aws/docker/library/node:20 AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install only production deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copy built app from build stage
COPY --from=build /app/dist ./dist

# Your server listens on this port
ENV PORT=5000
EXPOSE 5000

# Start the app
CMD ["node", "dist/index.js"]
