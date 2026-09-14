#!/bin/sh

expiration_days=60

rc alias set my_s3 "$AWS_ENDPOINT_URL_S3" "$AWS_ACCESS_KEY_ID" "$AWS_SECRET_ACCESS_KEY"
rc mb -p "my_s3/$1"
rc ilm rule add "my_s3/$1" --expiry-days $expiration_days
