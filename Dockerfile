# Multi-stage build — small runtime image, no build toolchain in the final layer.

FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma

FROM base AS deps
RUN npm install

FROM deps AS build
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

EXPOSE 4000
CMD ["node", "dist/server.js"]
