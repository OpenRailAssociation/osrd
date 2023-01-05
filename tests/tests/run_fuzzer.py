import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parents[1] / "fuzzer"))

import fuzzer


def list_tests():
    for i in range(5):

        def run_test(seed=i, *args, **kwargs):
            url = kwargs["url"]
            infra = kwargs["all_scenarios"]["tiny_infra"]
            fuzzer.run(url, infra, 1, seed=seed)
            return True, ""

        yield run_test, f"seed={i + 1}"
