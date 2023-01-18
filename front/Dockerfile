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

ARG NGINX_CONFIG=nginx.conf
COPY --from=build /app/build /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/$NGINX_CONFIG /etc/nginx/conf.d

RUN apk add npm

EXPOSE 80

ENV REACT_APP_LOCAL_BACKEND="True"
ENV REACT_APP_API_URL="http://localhost:8000"
ENV REACT_APP_CHARTIS_URL="http://localhost:7070"
ENV REACT_APP_EDITOAST_URL="http://localhost:8090"
ENV REACT_APP_KEYCLOAK_REALM="shared"
ENV REACT_APP_SENTRY_DSN=""
ENV REACT_APP_SENTRY_ENVIRONMENT=""

ENTRYPOINT npx react-inject-env set -d /usr/share/nginx/html/static/js/ && \
  nginx -g "daemon off;"
