FROM node:24-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY src ./src

ENV NODE_ENV=production
EXPOSE 8787
CMD ["node", "src/index.ts"]
