import json
import os
import sys
from pathlib import Path

import click
import subprocess

from common import download_s3_file, create_aws_session


@click.command(
    help="""
Downloads simulation inputs from the s3 for a past STDCM request,
then reproduces that same request.
The trace ID refers to datadog traces,
it's also included at the bottom of the simulation sheet.
"""
)
@click.option("--profile", "-p", default="default-ops-912306251540", type=str)
@click.option(
    "--s3-cache",
    "-s",
    type=click.Path(file_okay=False, path_type=Path, resolve_path=True),
    default=None,
)
@click.option("--bucket", "-b", default="osrd-dev", type=str)
@click.option(
    "--railjson-path",
    "-r",
    type=click.Path(dir_okay=False, path_type=Path),
    help="Path to the railjson file. Not saved in the s3 as they're rarely updated (though it could be added). "
    + "Can be downloaded from https://osrd_url/api/infra/infra_id/railjson/",
)
@click.option(
    "--core-path",
    "-c",
    type=click.Path(dir_okay=False, path_type=Path),
    help="Path to the core jar file, to run the command directly. If not set, the final command is just printed.",
)
@click.argument("trace-id")
def main(
    profile: str,
    s3_cache: Path | None,
    bucket: str,
    trace_id: str,
    railjson_path: Path | None,
    core_path: Path | None,
):
    if s3_cache is None:
        s3_cache = Path(__file__).resolve().parent / ".s3_cache"

    session = create_aws_session(profile)
    s3 = session.client("s3")
    payload_path = download_s3_file(
        s3,
        bucket,
        f"stdcm/requests/{trace_id}/input_payload.json",
        s3_cache,
    )
    payload = json.load(payload_path.open())
    cbor_timetable = download_s3_file(
        s3,
        bucket,
        f"stdcm/saved_timetables/{payload['timetable_id']}.cbor",
        s3_cache,
    )

    if railjson_path is None or not railjson_path.is_file():
        print(
            f"Missing railjson file, can be downloaded from osrd-url/api/infra/{payload['infra']}/railjson/"
        )
        railjson_path = Path("infra.json")

    # Copying the files in a stable place makes it easier to keep a stable IDE "run" config,
    # as the end goal is generally to debug that process in an IDE.
    payload_copy = payload_path.copy("input-payload.json")
    timetable_copy = cbor_timetable.copy("timetable.cbor")

    command = [
        "java",
        "-Xmx6G",  # can be adjusted depending on the available RAM
        "-ea",
        "-jar",
        str(core_path.resolve()) if core_path is not None else "osrd-all.jar",
        "reproduce-request",
        "--stdcm-payload-path",
        str(payload_copy.resolve()),
        "--railjson",
        str(railjson_path.resolve()),
        "--cbor-timetable",
        str(timetable_copy.resolve()),
    ]

    env_variables = {
        # Generates a file that can be forwarded to generate-debug-space-chart.py
        "STDCM_DEBUG_DATA_FILENAME": "debug_stdcm.json",
    }

    if core_path is not None:
        merged_env = {**os.environ, **env_variables}
        subprocess.run(command, env=merged_env, check=True)
    else:
        env_vars_str = " ".join(
            [f"{key}={value}" for key, value in env_variables.items()]
        )
        print("\nTo reproduce the request, run:\n")
        print(f"{env_vars_str} {' '.join(command)}")
        print()


if __name__ == "__main__":
    main()
