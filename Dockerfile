FROM node:21-alpine AS builder
WORKDIR /srv

COPY ./package.json ./yarn.lock /srv/

RUN yarn install --frozen-lockfile

COPY ./tsconfig.json ./src /srv/

RUN yarn build

FROM node:21-alpine
WORKDIR /srv

COPY ./package.json ./yarn.lock /srv/
COPY --from=builder /srv/dist /srv/dist

RUN yarn install --frozen-lockfile --production && \
    rm -rf /usr/local/share/.cache /tmp/*

EXPOSE 5000
CMD ["node", "dist/app.js"]
