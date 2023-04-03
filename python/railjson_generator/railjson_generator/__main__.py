from argparse import ArgumentParser
from pathlib import Path

from .scripts.generate import main

if __name__ == "__main__":
    parser = ArgumentParser(description="Runs infrastructure generation scripts")
    parser.add_argument("output_dir", type=Path, help="The output folder")
    parser.add_argument("scripts", nargs="*", help="The name of the scripts to run")
    args = parser.parse_args()
    main(args.scripts, args.output_dir)
