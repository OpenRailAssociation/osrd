FROM gateway_build

# Copy the front
WORKDIR /srv
COPY --from=front_build /app/build /srv/front/

# Copy an example config file
COPY --from=gateway_src ./gateway.prod.sample.toml /gateway.sample.toml
COPY --chmod=755 ./gateway-entrypoint.sh /srv/entrypoint.sh
ENTRYPOINT ["/srv/entrypoint.sh"]
CMD ["/usr/local/bin/osrd_gateway"]
