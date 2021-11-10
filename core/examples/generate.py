#!/usr/bin/env python3

import sys
import importlib
from pathlib import Path


if __name__ == "__main__":
    EXAMPLES_DIR = Path(__file__).parent
    LIB_GENERATOR = EXAMPLES_DIR / "generator"
    sys.path.append(str(LIB_GENERATOR.resolve()))

    for example in EXAMPLES_DIR.iterdir():
        if example.samefile(LIB_GENERATOR):
            continue
        gen_file = example / "gen.py"
        if gen_file.is_file():
            gen_module = example.stem + ".gen"
            importlib.import_module(gen_module)
