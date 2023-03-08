# Integration tests


### Run the tests
To run tests `poetry run pytest` after starting docker containers(`docker-compose up` at the root of the project).

To run a list of specific tests, run `poetry run pytest -k test_name_1 test_name_2 ...`.

### Create new integration tests

To add a test, follow [pytest doc](https://docs.pytest.org/).
Available fixtures are defined in `conftest.py`.

# Fuzzer

The fuzzer is a script that generates random tests and logs any error that occurred.
Run `python3 fuzzer/fuzzer.py`, any error will be reported in `fuzzer/errors` in a json.

Note: you need a docker running locally *with at least one infra imported*.
It can be a generated infra, or it can be imported from some other DB.

If the test is run on a generated infra, the json containing the error report
can be copied to `tests/regression_tests_data/` to integrate it into the test suite.
