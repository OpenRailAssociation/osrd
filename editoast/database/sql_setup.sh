#!/bin/bash
set -e

# To test the rustls connector, use this postgres setup:
# docker run --rm -p 5433:5433 --volume ./sql_setup.sh:/docker-entrypoint-initdb.d/sql_setup.sh --env POSTGRES_PASSWORD=postgres docker.io/postgres:18
#
# then run the tests: cargo test -p database postgres_rustls
#
# If you need to create a new certificate chain (CA cert + server cert+key), see
# this guide: https://gist.github.com/kfreezen/cf065810b13660abebc925f94b96e2af

cat > "$PGDATA/server.key" <<-EOKEY
-----BEGIN EC PRIVATE KEY-----
MHcCAQEEILVow+yesm9WZ+jo3K1mOJKeyTNXBmWW+aoXCTUFKC7goAoGCCqGSM49
AwEHoUQDQgAEFBMsT0X4WuL49agwtSee9GERRtWvY32je0stLkrarc5qIxHByFYS
CJQ9TH8cwvRaMDyOFZ0TJL2bVi0AY+0hJw==
-----END EC PRIVATE KEY-----
EOKEY
chmod 0600 "$PGDATA/server.key"

cat > "$PGDATA/server.crt" <<-EOCERT
-----BEGIN CERTIFICATE-----
MIICNDCCAbqgAwIBAgIUQOoiNo32iym8Bxj2/S1F3FrVqoowCgYIKoZIzj0EAwIw
RTELMAkGA1UEBhMCQVUxEzARBgNVBAgMClNvbWUtU3RhdGUxITAfBgNVBAoMGElu
dGVybmV0IFdpZGdpdHMgUHR5IEx0ZDAgFw0yNjA5MDIxMzIyMDBaGA8yMTI2MDgw
OTEzMjIwMFowRDELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMRQwEgYDVQQKDAtN
eU9yZywgSW5jLjESMBAGA1UEAwwJbG9jYWxob3N0MFkwEwYHKoZIzj0CAQYIKoZI
zj0DAQcDQgAEFBMsT0X4WuL49agwtSee9GERRtWvY32je0stLkrarc5qIxHByFYS
CJQ9TH8cwvRaMDyOFZ0TJL2bVi0AY+0hJ6OBhjCBgzAfBgNVHSMEGDAWgBTHeTxy
zH1FYwgnvE82pHPAblLuTDAJBgNVHRMEAjAAMAsGA1UdDwQEAwIFoDATBgNVHSUE
DDAKBggrBgEFBQcDATAUBgNVHREEDTALgglsb2NhbGhvc3QwHQYDVR0OBBYEFBer
/ndduod0ke+He9j22ZyS8974MAoGCCqGSM49BAMCA2gAMGUCMGGxTaC++GQzsKTg
EGpoBjOMku5/Jn+qcuzmFyaQC+KG1FbCqxjo0V/e+npPt5KKowIxAN5p0hnFomWC
F09JLTJQcP3LyCT7/+W9F/a6SahNLD/RcuRQShWcfaMl+mAyGczOoA==
-----END CERTIFICATE-----
EOCERT

cat >> "$PGDATA/postgresql.conf" <<-EOCONF
port = 5433
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
EOCONF

cat > "$PGDATA/pg_hba.conf" <<-EOCONF
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    all             pass_user       0.0.0.0/0            password
host    all             md5_user        0.0.0.0/0            md5
host    all             scram_user      0.0.0.0/0            scram-sha-256
host    all             pass_user       ::0/0                password
host    all             md5_user        ::0/0                md5
host    all             scram_user      ::0/0                scram-sha-256

hostssl all             ssl_user        0.0.0.0/0            trust
hostssl all             ssl_user        ::0/0                trust
host    all             ssl_user        0.0.0.0/0            reject
host    all             ssl_user        ::0/0                reject

# IPv4 local connections:
host    all             postgres        0.0.0.0/0            trust
# IPv6 local connections:
host    all             postgres        ::0/0                trust
# Unix socket connections:
local   all             postgres                             trust
EOCONF

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE ROLE pass_user PASSWORD 'password' LOGIN;
    CREATE ROLE md5_user PASSWORD 'password' LOGIN;
    SET password_encryption TO 'scram-sha-256';
    CREATE ROLE scram_user PASSWORD 'password' LOGIN;
    CREATE ROLE ssl_user LOGIN;
    CREATE EXTENSION hstore;
    CREATE EXTENSION citext;
    CREATE EXTENSION ltree;
EOSQL
