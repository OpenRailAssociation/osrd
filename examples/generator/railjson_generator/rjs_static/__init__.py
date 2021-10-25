import json
from pathlib import Path
import sys

this = sys.modules[__name__]  # this is now your current namespace


def load(path):
    with open(path) as f:
        return json.load(f)


for path in Path(__file__).parent.iterdir():
    if path.suffix != ".json":
        continue
    setattr(this, path.stem.upper(), load(path))
