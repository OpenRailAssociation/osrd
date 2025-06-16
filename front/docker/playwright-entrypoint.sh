#!/bin/bash

rm -f /tmp/ready
npm ci
touch /tmp/ready     # Signals that the container is ready
read -rp "ZZZzzz..." # Prevents the container from closing
