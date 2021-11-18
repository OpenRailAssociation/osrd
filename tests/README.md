# Integration tests

To start the tests, run `python3 run_integration_tests.py` after starting a docker
(`docker-compose up` at the root of the project)

To add a test, create a python file in the `tests/` folder with the other tests.
Inside, create a `run(*args, **kwargs)` function. It will be given some parameters
in the `kwargs`, for now it contains:

```json
{
  "infra_id": new infra id (int),
  "url": api url
}
```


# Fuzzer

The fuzzer is a script that generates random tests and logs any error that occurred.
Run `python3 fuzzer/fuzzer.py`, any error will be logged in `fuzzer/errors`.

Note: you need a docker running locally *with a database setup with a real infra*.
This data isn't publicly available yet. 
