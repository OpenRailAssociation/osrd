import subprocess
import importlib
import sys
from pathlib import Path

import requests


URL = "http://127.0.0.1:8080/"


def setup():
    result = subprocess.run(
        ["docker", "exec", "osrd-api", "python", "manage.py", "setup_dummy_db"],
        stdout=subprocess.PIPE
    )
    if result.returncode != 0:
        raise RuntimeError("setup failed")
    return int(result.stdout)


def clean(base_url, infra_id):
    response = requests.delete(base_url + f"infra/{infra_id}/")
    if response.status_code // 100 != 2:
        raise RuntimeError(f"Cleanup failed, code {response.status_code}: {response.content}")


# noinspection PyBroadException
def run_single_test(module, infra_id):
    passed, error = module.run(infra_id=infra_id, url=URL)
    if not passed:
        return False, error
    return True, ""


def find_test_modules():
    root = Path(__file__).parent / "tests"
    for f in root.glob("*.py"):
        test_module = f"{root.stem}.{f.stem}"
        module = importlib.import_module(test_module)
        yield module, f.stem


def run_all():
    infra_id = setup()
    n_total = 0
    n_passed = 0
    for module, name in find_test_modules():
        passed, error = run_single_test(module, infra_id)
        print(f"{name}: ", end="")
        if passed:
            print("PASS")
            n_passed += 1
        else:
            print("FAIL", error)
        n_total += 1

    print(f"{n_passed} / {n_total}")
    clean(URL, infra_id)
    return 1 if n_passed < n_total else 0


if __name__ == "__main__":
    sys.exit(run_all())