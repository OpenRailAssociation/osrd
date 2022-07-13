# Build APP with node
FROM node:lts-alpine as build

WORKDIR /app

ENV PATH /app/node_modules/.bin:$PATH

# build dependencies
COPY package.json yarn.lock /app/
RUN yarn

# setup build options
ARG REACT_APP_LOCAL_BACKEND
ARG REACT_APP_API_URL
ARG REACT_APP_CHARTIS_URL

# build the app
COPY . /app
RUN REACT_APP_LOCAL_BACKEND=$REACT_APP_LOCAL_BACKEND \
    REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_CHARTIS_URL=$REACT_APP_CHARTIS_URL \
    yarn build

# Copy & serve app
FROM nginx:alpine

ARG NGINX_CONFIG=nginx.conf
COPY --from=build /app/build /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/$NGINX_CONFIG /etc/nginx/conf.d

EXPOSE 80

ENTRYPOINT ["nginx", "-g", "daemon off;"]
