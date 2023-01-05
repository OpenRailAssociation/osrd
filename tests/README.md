# Integration tests


### Run the tests
To start the tests, run `python3 run_integration_tests.py` after starting a docker
(`docker-compose up` at the root of the project).

To run a list of specific tests, run `python3 run_integration_tests.py test_name_1 test_name_2 ...`.

### Create new integration tests

To add a test, create a python file in the `tests/` folder with the other tests.
Inside, create a `run(*args, **kwargs)` function. It will be given some parameters
in the `kwargs`, for now it contains:

```json
{
  "all_scenarios": {
    "dummy": infra, project, operational study and scenario,
    "tiny": infra, project, operational study and scenario,
    "small": infra, project, operational study and scenario
  },
  "url": api url
}
```

The python file can instead contain a function `list_tests() -> Iterable[Tuple[string, Callable]]`.
In this case, it will be called to get a list of tests.


# Fuzzer

The fuzzer is a script that generates random tests and logs any error that occurred.
Run `python3 fuzzer/fuzzer.py`, any error will be reported in `fuzzer/errors` in a json.

Note: you need a docker running locally *with at least one infra imported*.
It can be a generated infra, or it can be imported from some other DB.

If the test is run on a generated infra, the json containing the error report
can be copied to `tests/regression_fuzzer_tests/` to integrate it into the test suite.
