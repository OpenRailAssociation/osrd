# Chartos

This service provides chartographic layers in the form of [MVT tiles](https://gdal.org/drivers/vector/mvt.html). The service is configured with a YAML file [chartos.yml](chartos.yml).

## Requirements

We're using [poetry](https://poetry.eustace.io/) to manage dependencies.

To setup an environment with all dependencies, run `poetry install`.

## Run the server

You can override the default configuration using environment variables:

| Variable        | Default Value                                  |
| --------------- | ---------------------------------------------- |
| `ROOT_URL`      | `http://localhost:8000`                        |
| `CONFIG_PATH`   | `chartos.yml`                                  |
| `PSQL_DSN`      | `postgres://osrd:password@localhost:5432/osrd` |
| `PSQL_USER`     | `None`                                         |
| `PSQL_PASSWORD` | `None`                                         |
| `REDIS_URL`     | `redis://localhost:6379`                       |
| `MAX_ZOOM`      | `18`                                           |

Then to run the service:
```shell
$ uvicorn chartos:app --port 7000
```

## Run tests

Simply run `pytest` from the project root.

## Tools

- [black](https://black.readthedocs.io/en/stable/) - Code formatter
- [flake8](https://flake8.readthedocs.io/en/latest/) - Code linter
