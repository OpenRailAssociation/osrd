# OSRD's Gateway

Gateway is an authenticating reverse proxy. It's designed as:
- a **gatekeeper**, which ensures all requests which require authentication are, and allows clients to authenticate
- a **reverse proxy**, which relays requests to their destination.

Authenticated upstream requests include a `X-Request-User` HTTP header, which contains an opaque user identifier.

It supports the following authentication providers:
- OpenID connect (base specification only, no refresh nor fancy disconnect)
- static Bearer tokens
- a mock provider, for development and testing

This component is built around 3 crates:
- actix_auth provides an authentication middleware, and authentication endpoints
- actix_proxy implements a customizable actix reverse proxy service

## Config

The gateway reads `gateway.toml` in its current working directory.
Please refer to `gateway.bundled.toml` for a relevant example.

```toml
# Address on which the gateway will listen
listen_addr = "0.0.0.0"
# Port on which the gateway will listen
port = 80
# A base64-encoded secret key, used to encrypt and sign cookies
# generate a production key with this command:
# python3 -c "import secrets, base64; print(base64.standard_b64encode(secrets.token_bytes(64)).decode())"
secret_key = "NOT+A+SECRET++NOT+A+SECRET++NOT+A+SECRET++NOT+A+SECRET++NOT+A+SECRET++NOT+A+SECRET++NOT+A+SECRET"

# List of trusted proxies (for X-Forwarded-For)
trusted_proxies = ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]

# Folder to serve as static files on the default route
[static_files]
root_folder = "/srv/front"
redirect_404_to_index = true

# Targets are reverse proxy routes.
# Add multiple ones by duplicating this section.
[[targets]]
# The request path must start with this prefix for the target to apply.
# If omitted, the target becomes the default. There can only be a single default target.
# Note that editoast's ROOT_URL should be specified accordingly.
prefix = "/api"
# The base URL requests are proxied to (must include the scheme)
upstream = "http://localhost:8090"
# Whether requests need authentication to be relayed upstream.
# If true, unauthenticated requests get a 401 Unauthorized response.
require_auth = true
# A list of headers that need to be forwarded. If omitted, all headers are forwarded.
# Omitting this field is not recommended, as it can introduce normalization induced priviledge escalation.
forwarded_headers = ["TODO"]
# An I/O timeout in SI suffixed units
timeout = "20s"

[auth]
# the default provider used when calling /auth/login
default_provider = "oidc_test"

# An example OpenID Connect identity provider
[[auth.providers]]
type = "Oidc"
# An unique ID to be referenced by default_provider.
# It's used in the public API
provider_id = "oidc_test"
# The issuer_url must match what's reported during OIDC metadata discovery.
# Any mismatch will cause an abort at server startup
issuer_url = "https://%PROVIDER_URL%"
# The URL users are redirected to after logging in
post_login_url = "https://%POST_LOGIN_URL%"
# The callback URL, as whitelisted in the OIDC provider.
# /!\ the URL contains the provider id /!\
callback_url = "https://%APP_ROOT_URL%/auth/provider/oidc_test/callback"
# The client ID and secret are given by the OIDC OP
client_id = "%CLIENT_ID%"
client_secret = "%CLIENT_SECRET%"

# A test identity provider
[[auth.providers]]
type = "Mocked"
provider_id = "mock"
# The username reported to the front-end
username = "Example User"
```

# Enable open telemetry
```toml
[telemetry.tracing]
endpoint = "http://localhost:4317"
type = "Otlp"
enable = true
service_name = "gateway"
```
