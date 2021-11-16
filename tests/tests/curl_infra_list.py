import subprocess
import json


def run():
    result = subprocess.run(["curl", "http://localhost:8080/"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE)
    if result.returncode != 0:
        return False, f"curl returned {result.returncode} ({result.stderr})"
    json.loads(result.stdout)  # Throws an exception if a problem happens
    return True, ""

