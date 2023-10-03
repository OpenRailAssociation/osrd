#!/bin/sh
(sleep 3; xdg-open 'http://localhost:4000') &
import-meta-env-prepare -x .env.example && vite
