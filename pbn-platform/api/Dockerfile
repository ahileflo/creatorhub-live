FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY web ./web
COPY public ./public
RUN mkdir -p .data/keys /data/storage && chown -R node .data /data/storage
USER node
CMD ["node", "src/server.js"]
