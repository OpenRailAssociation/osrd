import subprocess
from pathlib import Path

FRONT_FOLDER = Path(__file__).parents[2] / "front"
MIDDLEWARE_FOLDER = FRONT_FOLDER / "src" / "common" / "api"
MIDDLEWARE_FILES = {
    "editoast": MIDDLEWARE_FOLDER / "osrdEditoastApi.ts",
}


def test_rtk_middlewares_are_in_sync_with_openapi_files():
    current_content = {name: file.read_text() for name, file in MIDDLEWARE_FILES.items()}
    subprocess.check_output(["yarn", "generate-types-ci"], cwd=FRONT_FOLDER)
    updated_content = {name: file.read_text() for name, file in MIDDLEWARE_FILES.items()}
    for name in MIDDLEWARE_FILES.keys():
        assert current_content[name] == updated_content[name]
