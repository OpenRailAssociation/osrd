# Build APP with node
FROM node:lts-alpine as build

WORKDIR /app
COPY . /app

ENV PATH /app/node_modules/.bin:$PATH

RUN yarn
RUN yarn build

# Copy & serve app
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d

EXPOSE 80

ENTRYPOINT ["nginx", "-g", "daemon off;"]
