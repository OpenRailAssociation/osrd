#!/bin/sh

mc alias set my_s3 "$AWS_ENDPOINT_URL_S3" "$AWS_ACCESS_KEY_ID" "$AWS_SECRET_ACCESS_KEY"
mc mb -p "my_s3/$1"
