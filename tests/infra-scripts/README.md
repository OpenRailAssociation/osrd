:warning: When an infrastructure script is changed, test data has to be rebuilt :warning:

Run the following commands at the root of the project:
```sh
poetry -C python/railjson_generator install
poetry -C python/railjson_generator run python -m railjson_generator tests/data/infras tests/infra-scripts/*.py
```
