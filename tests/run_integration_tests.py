import importlib
import json
import subprocess
import sys
import traceback
from pathlib import Path
from typing import Dict, List, Tuple

import requests

URL = "http://localhost:8000/"
EDITOAST_URL = "http://localhost:8090/"


def setup() -> Dict[str, int]:
    """
    Setups the test environment with a minimal DB
    :return: new infra ID
    """
    result = subprocess.check_output(
        ["docker", "exec", "osrd-api", "python", "manage.py", "setup_dummy_db"],
    )
    infra_id = int(result)
    _create_schedule(infra_id)

    infras = {}
    infras["dummy"] = infra_id
    for infra in ["tiny_infra", "small_infra"]:
        infras[infra] = _load_generated_infra(infra)
        _create_schedule(infras[infra])
    return infras


def _load_generated_infra(name: str) -> int:
    generator = Path(__file__).resolve().parents[1] / "core/examples/generated/generate.py"
    output = Path("/tmp/osrd-generated-examples")
    infra = output / f"{name}/infra.json"
    subprocess.check_call(["python3", str(generator), str(output), name])
    subprocess.check_call(["docker", "cp", str(infra), "osrd-api:/infra.json"])
    result = subprocess.check_output(
        ["docker", "exec", "osrd-api", "python", "manage.py", "import_railjson", name, "/infra.json"],
    )
    id = int(result.split()[-1])
    return id


def _create_schedule(infra_id: int):
    """
    Creates a schedule linked to the given infra
    :param infra_id: infra id
    """
    timetable_payload = {"name": "foo", "infra": infra_id}
    r = requests.post(URL + "timetable/", json=timetable_payload)
    if r.status_code // 100 != 2:
        err = f"Error creating schedule {r.status_code}: {r.content}, payload={json.dumps(timetable_payload)}"
        raise RuntimeError(err)


def clean(infra_ids: Dict[str, int]):
    """
    Clean the environment, deletes the new infras
    :param infra_ids: infra id for each name
    """
    for infra_id in infra_ids.values():
        response = requests.delete(EDITOAST_URL + f"infra/{infra_id}/")
        if response.status_code // 100 != 2:
            raise RuntimeError(f"Cleanup failed, code {response.status_code}: {response.content}")


# noinspection PyBroadException
def run_single_test(function, infra_ids) -> Tuple[bool, str]:
    """
    Runs a single test module
    :param function: function to run, should have the prototype `function(*args, **kwargs)`
    :param infra_ids: dict with all the infra ids
    :return: (test passed, error message)
    """
    try:
        passed, error = function(url=URL, all_infras=infra_ids)
        if not passed:
            return False, error
    except Exception:
        return False, traceback.format_exc()
    return True, ""


def find_test_modules():
    """
    Generator returning a list of modules
    :return: (module, file name)
    """
    root = Path(__file__).parent
    test_folder = root / "tests"
    for f in test_folder.glob("**/*.py"):
        module_name = ".".join(f.relative_to(root).with_suffix("").parts)
        test_name = "/".join(f.relative_to(test_folder).with_suffix("").parts)
        module = importlib.import_module(module_name)
        yield module, test_name


def run_all(tests_to_run: List[str]) -> int:
    """
    Runs all the given tests. If the test list is empty, all the tests are run
    :param tests_to_run: list of test names to run
    :return: 0 if every test passed, 1 otherwise (exit code)
    """
    infra_ids = setup()
    n_total = 0
    n_passed = 0
    tests = {}
    for module, name in find_test_modules():
        if hasattr(module, "run"):
            tests[name] = module.run
        elif hasattr(module, "list_tests"):
            for function, function_name in module.list_tests():
                test_name = f"{name}:{function_name}"
                tests[test_name] = function

    if not tests_to_run:
        tests_to_run = tests.keys()

    for test_name in tests_to_run:
        if test_name not in tests:
            print(f"'{test_name}' doesn't exists")
            print(f"Possible tests are: [{', '.join(tests.keys())}]")
            exit(2)
        function = tests[test_name]
        passed, error = run_single_test(function, infra_ids)
        print(f"{test_name}: ", end="")
        if passed:
            print("PASS")
            n_passed += 1
        else:
            print("FAIL", error[:4096])
        n_total += 1

    print(f"{n_passed} / {n_total}")
    clean(infra_ids)
    return 1 if n_passed < n_total else 0


if __name__ == "__main__":
    sys.exit(run_all(sys.argv[1:]))
