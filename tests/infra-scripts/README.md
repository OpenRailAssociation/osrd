:warning: When an infrastructure script is changed, test data has to be rebuilt :warning:

Run the following commands at the root of the project:

```sh
uv --directory python/railjson_generator sync --all-extras
uv --directory python/railjson_generator run -m railjson_generator "$PWD"/tests/data/infras "$PWD"/tests/infra-scripts/*.py
```
