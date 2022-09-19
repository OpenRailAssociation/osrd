#!/bin/sh
export REACT_APP_LOCAL_BACKEND=true
export REACT_APP_API_URL=http://localhost:8000
export REACT_APP_CHARTIS_URL=http://localhost:7000
export REACT_APP_EDITOAST_URL=http://localhost:8090
export REACT_SENTRY_DSN=https://fd0b50aa200d4d2cb58decfeabcbdef2@sentry.shared.dgexsol.fr/38
yarn start
