#!/usr/bin/env python3

import subprocess
import sys
from argparse import ArgumentParser
from pathlib import Path
from typing import Iterable


def run_script(gen_script: Path, output_dir: Path):
    assert gen_script.is_file(), f"{gen_script} is not a valid file name"
    script_name = gen_script.stem
    script_output = output_dir / script_name
    script_output.mkdir(parents=True, exist_ok=True)
    print("running generation script", script_name)
    subprocess.run([sys.executable, gen_script, script_output], check=True)


def main(scripts: Iterable[Path], output_dir: Path):
    scripts_dir = Path(__file__).parent / "examples"

    if not scripts:
        for gen_script in scripts_dir.glob("*.py"):
            run_script(gen_script, output_dir)
    else:
        for script_name in scripts:
            script_path = Path(script_name)
            if not script_path.is_file():
                script_path = scripts_dir / f"{script_name}.py"
            run_script(script_path, output_dir)


if __name__ == "__main__":
    parser = ArgumentParser(description="Runs infrastructure generation scripts")
    parser.add_argument("output_dir", type=Path, help="The output folder")
    parser.add_argument("scripts", nargs="*", help="The name of the scripts to run")
    args = parser.parse_args()

    main(args.scripts, args.output_dir)
