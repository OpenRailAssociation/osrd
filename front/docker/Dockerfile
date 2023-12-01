######################
# Cache dependencies #
######################

FROM node:18-bookworm as base_build

WORKDIR /app

# Build dependencies
COPY package.json yarn.lock /app/
RUN yarn install

######################
# Testing env: build #
######################

FROM base_build as test_build

# Generate the licenses file and build
COPY . /app
RUN yarn generate-licenses && NODE_OPTIONS=--max-old-space-size=6500 yarn coverage-build

######################
# Testing env: serve #
######################

FROM nginx:alpine as test_serve

RUN apk add npm && \
    npm install -g @import-meta-env/cli && \
    rm /etc/nginx/conf.d/default.conf

COPY docker/nginx.conf /etc/nginx/conf.d
COPY docker/nginx-entrypoint.sh /entrypoint.sh

COPY --from=test_build /app/build /srv
COPY --from=test_build /app/.env.example /

ENV OSRD_BACKEND_URL=""
ENV OSRD_SENTRY_DSN=""
ENV OSRD_SENTRY_ENVIRONMENT=""

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}

ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "npx import-meta-env -x /.env.example -p /srv/index.html && exec nginx -g 'daemon off;'"]

####################
# Production build #
####################

FROM base_build as prod_build

# Generate the licenses file and build
COPY . /app
RUN yarn generate-licenses && yarn build
