import subprocess
from pathlib import Path

FRONT_FOLDER = Path(__file__).parent.parent.parent / "front"
MIDDLEWARE_FOLDER = FRONT_FOLDER / "src" / "common" / "api"
MIDDLEWARE_FILES = {
    "api": MIDDLEWARE_FOLDER / "osrdEditoastApi.ts",
    "editoast": MIDDLEWARE_FOLDER / "osrdMiddlewareApi.ts",
}


def test_rtk_middlewares_are_in_sync_with_openapi_files():
    current_content = {name: file.read_text() for name, file in MIDDLEWARE_FILES.items()}
    subprocess.check_output(["yarn", "generate-types"], cwd=FRONT_FOLDER)
    updated_content = {name: file.read_text() for name, file in MIDDLEWARE_FILES.items()}
    for name in MIDDLEWARE_FILES.keys():
        assert current_content[name] == updated_content[name]
