#!/bin/sh
TSC_COMPILE_ON_ERROR=true REACT_APP_LOCAL_BACKEND=True REACT_APP_API_URL=http://localhost:8000 REACT_APP_CHARTIS_URL=http://localhost:7000 yarn start
