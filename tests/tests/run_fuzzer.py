import sys
from pathlib import Path
from tests.get_infras import get_infras

sys.path.append(str(Path(__file__).parents[1] / "fuzzer"))

import fuzzer


def run(*args, **kwargs):
    url = kwargs["url"]
    infra = kwargs["all_infras"]["tiny"]
    fuzzer.run(url, infra, 5)
    return True, ""
