import json
import subprocess
import importlib
import sys
import traceback
from pathlib import Path
from typing import Tuple, Dict

import requests


URL = "http://127.0.0.1:8000/"


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
    infras["tiny"] = _load_tiny_infra()
    return infras


def _load_tiny_infra() -> int:
    generator = Path(__file__).parents[1] / "core/examples/generated/generate.py"
    output = Path("/tmp/osrd-generated-examples")
    tiny_infra = output / "tiny_infra/infra.json"
    subprocess.check_call(["python3", str(generator), str(output), "tiny_infra"])
    subprocess.check_call(["docker", "cp", str(tiny_infra), "osrd-api:/infra.json"])
    result = subprocess.check_output(
        ["docker", "exec", "osrd-api", "python", "manage.py", "import_railjson", "tiny_infra", "/infra.json"],
    )
    id = int(result.split()[-1])
    return id


def _create_schedule(infra_id: int):
    """
    Creates a schedule linked to the given infra
    :param infra_id: infra id
    """
    timetable_payload = {
        "name": "foo",
        "infra": infra_id
    }
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
        response = requests.delete(URL + f"infra/{infra_id}/")
        if response.status_code // 100 != 2:
            raise RuntimeError(f"Cleanup failed, code {response.status_code}: {response.content}")


# noinspection PyBroadException
def run_single_test(module, infra_ids) -> Tuple[bool, str]:
    """
    Runs a single test module
    :param module: loaded test module, should contain a function `run(*args, **kwargs)`
    :param infra_id: infra id
    :return: (test passed, error message)
    """
    try:
        passed, error = module.run(infra_id=infra_ids["dummy"], url=URL, all_infras=infra_ids)
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
    root = Path(__file__).parent / "tests"
    for f in root.glob("*.py"):
        test_module = f"{root.stem}.{f.stem}"
        module = importlib.import_module(test_module)
        yield module, f.stem


def run_all() -> int:
    """
    Runs all the tests present in the tests folder
    :return: 0 if every test passed, 1 otherwise (exit code)
    """
    infra_ids = setup()
    n_total = 0
    n_passed = 0
    for module, name in find_test_modules():
        passed, error = run_single_test(module, infra_ids)
        print(f"{name}: ", end="")
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
    sys.exit(run_all())
