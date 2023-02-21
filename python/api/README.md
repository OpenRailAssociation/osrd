# OSRD's API

[![API](https://github.com/DGEXSolutions/osrd/actions/workflows/api.yml/badge.svg)](https://github.com/DGEXSolutions/osrd/actions/workflows/api.yml)

This service handle OSRD models and schema using [Django](https://www.djangoproject.com/).
Multiple extension are used such as:
  - [Django Rest Framework](https://www.django-rest-framework.org/)
  - [Django Rest Framework Gis](https://github.com/openwisp/django-rest-framework-gis)
  - [Pydantic](https://pydantic-docs.helpmanual.io/)

## Getting Started

If you want to contribute to this service you need:

- A running [postgres](https://www.postgresql.org/) server with [postgis](https://postgis.net/)
extension.
  - The simpliest way to do it is using docker compose: `docker-compose up -d --build postgres`.
- [Poetry](https://python-poetry.org/) a python package manager.

To get a django configuration suitable for local development, set `OSRD_DEV=1`.

```sh
# Install dependencies
poetry install

# Apply migrations
OSRD_DEV=1 python manage.py migrate

# Run server
OSRD_DEV=1 python manage.py runserver
```

The API webserver should now be running you can try to access the admin panel: http://localhost:8000/admin/
