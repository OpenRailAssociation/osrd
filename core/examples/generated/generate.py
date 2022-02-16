#!/usr/bin/env python3

import sys
import os
import subprocess
from pathlib import Path
from argparse import ArgumentParser


def run_script(gen_script: Path, script_env, output_dir: Path):
    assert gen_script.is_file()
    script_name = gen_script.stem
    script_output = output_dir / script_name
    script_output.mkdir(parents=True, exist_ok=True)
    print("running generation script", script_name)
    subprocess.run(
        [sys.executable, gen_script, script_output],
        env=script_env, check=True
    )


def main():
    parser = ArgumentParser(description="Runs infrastructure generation scripts")
    parser.add_argument("output_dir", type=Path, help="The output folder")
    parser.add_argument("scripts", nargs="*", help="The name of the scripts to run")
    args = parser.parse_args()

    generator_dir = Path(__file__).parent
    scripts_dir = generator_dir / "scripts"
    lib_dir = generator_dir / "lib"

    # build PYTHONPATH to include the library
    old_pythonpath = os.getenv("PYTHONPATH", "")
    new_pythonpath = str(lib_dir.resolve())
    if old_pythonpath:
        new_pythonpath += os.pathsep + old_pythonpath

    scripts_env = {
        **os.environ,
        "PYTHONPATH": new_pythonpath,
    }

    if not args.scripts:
        for gen_script in scripts_dir.glob("*.py"):
            run_script(gen_script, scripts_env, args.output_dir)
    else:
        for script_name in args.scripts:
            script_path = scripts_dir / f"{script_name}.py"
            run_script(script_path, scripts_env, args.output_dir)


if __name__ == "__main__":
    main()
