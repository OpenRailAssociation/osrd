# Build APP with node
FROM node:16-alpine as build

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

# build dependencies
COPY package.json yarn.lock /app/
RUN yarn

# build the app
COPY . /app
RUN yarn build

# Copy & serve app
FROM nginx:alpine

RUN apk add npm

RUN npm install -g @import-meta-env/cli

ARG NGINX_CONFIG=nginx.conf
COPY --from=build /app/build /usr/share/nginx/html
COPY --from=build /app/.env.example /
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/$NGINX_CONFIG /etc/nginx/conf.d

EXPOSE 80

ENV OSRD_LOCAL_BACKEND="false"
ENV OSRD_API_URL=""
ENV OSRD_EDITOAST_URL=""
ENV OSRD_KEYCLOAK_REALM=""
ENV OSRD_SENTRY_DSN=""
ENV OSRD_SENTRY_ENVIRONMENT=""

ARG OSRD_GIT_DESCRIBE
ENV OSRD_GIT_DESCRIBE=${OSRD_GIT_DESCRIBE}

ENTRYPOINT npx import-meta-env -x /.env.example -p /usr/share/nginx/html/index.html && \
  nginx -g "daemon off;"
