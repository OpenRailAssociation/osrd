# Chartos

This service provides chartographic layers in the form of [MVT tiles](https://gdal.org/drivers/vector/mvt.html). The service is configured with a YAML file [chartos.yml](chartos.yml).

## Requirements

We're using [poetry](https://poetry.eustace.io/) to manage dependencies.

To setup an environment with all dependencies, run `poetry install`.

## Run the server

You can override the default configuration using environment variables:

| Variable        | Description                                    | Default Value                                  |
| --------------- | ---------------------------------------------- | ---------------------------------------------- |
| `ROOT_URL`      | Service root url                               | `http://localhost:8000`                        |
| `CONFIG_PATH`   | Path to the layers configuration               | `chartos.yml`                                  |
| `PSQL_DSN`      | Postgresql connexion DSN                       | `postgres://osrd:password@localhost:5432/osrd` |
| `PSQL_USER`     | Postgresql user                                | `None`                                         |
| `PSQL_PASSWORD` | Postgresql password                            | `None`                                         |
| `REDIS_URL`     | Redis connexion url                            | `redis://localhost:6379`                       |
| `MAX_ZOOM`      | Max zoom allowed                               | `18`                                           |
| `MAX_TILES`     | Max number of tiles invalidate at once         | `250_000`                                      |

Then to run the service:
```shell
$ uvicorn chartos:make_app --port 7070
```

## Run tests

Simply run `pytest` from the project root.

## Tools

- [black](https://black.readthedocs.io/en/stable/) - Code formatter
- [flake8](https://flake8.readthedocs.io/en/latest/) - Code linter
