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
    if not scripts:
        print("no scripts specified, nothing will be generated", file=sys.stderr)
        sys.exit(1)

    for script_name in scripts:
        script_path = Path(script_name)
        if not script_path.is_file():
            print("script isn't a file:", script_name, file=sys.stderr)
            sys.exit(1)
        run_script(script_path, output_dir)


if __name__ == "__main__":
    parser = ArgumentParser(description="Runs infrastructure generation scripts")
    parser.add_argument("output_dir", type=Path, help="The output folder")
    parser.add_argument("scripts", nargs="*", help="Paths of generation scripts")
    args = parser.parse_args()
    main(args.scripts, args.output_dir)
