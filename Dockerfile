FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY *.mjs index.html styles.css ./
COPY assets ./assets
COPY vendor ./vendor
ENV NODE_ENV=production
ENV LOT_ROT_DB=/data/lot-rot.sqlite
ENV LOT_ROT_AUTH=/data/account.json
CMD ["node", "server.mjs"]
