from importlib.machinery import ModuleSpec
import importlib.util
import sys
from argparse import ArgumentParser
from pathlib import Path
from types import ModuleType
from typing import Iterable


def import_module_from_path(module_name: str, file_path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    assert isinstance(spec, ModuleSpec)
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


small_infra_creator_module = import_module_from_path(
    "small_infra_creator",
    Path("../../tests/infra-scripts/small_infra_creator/__init__.py"),
)
sys.modules["small_infra_creator"] = small_infra_creator_module


def run_script(gen_script: Path, output_dir: Path):
    assert gen_script.is_file(), f"{gen_script} is not a valid file name"
    script_name = gen_script.stem
    script_output = output_dir / script_name
    script_output.mkdir(parents=True, exist_ok=True)
    print("running generation script", script_name)
    module = import_module_from_path(script_name, gen_script)
    module.scenario_data.infra.save(script_output / "infra.json")
    module.scenario_data.external_inputs.save(
        script_output / "external_generated_inputs.json"
    )


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
