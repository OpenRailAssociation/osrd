# Railway manager interface

This repository contains the OpenAPI specification that defines an interface which the OSRD frontend can call in order to handle custom and/or private data processes.

## Overview

The `railway-manager-interface` is a service that handles user-specific operations and transformations. **You are responsible for implementing your own service** that adheres to the interface.

## OpenAPI Specification

The `openapi.yaml` file in this repository describes all the HTTP endpoints that the OSRD frontend expects from a Railway manager interface service. This specification serves as a reference to understand:

- How the frontend uses the endpoints
- What request formats are expected
- What response formats should be returned
- What error handling is required

By following this OpenAPI specification, you can ensure that your Railway manager interface implementation will be compatible with the OSRD frontend.
