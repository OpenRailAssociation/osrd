import os
from pathlib import Path

import click
import subprocess

from common import download_s3_file, create_aws_session


@click.command(
    help="""
Downloads simulation data from the s3 for a past STDCM request,
then renders the space-time chart.
The trace ID refers to datadog traces,
it's also included at the bottom of the simulation sheet.

Requires setting up a prod AWS access, see README here:
https://gitlab-repo-res.apps.eul.sncf.fr/dsir/groupedxs-dsir/04735/osrd
"""
)
@click.option(
    "--profile",
    "-p",
    type=str,
    help="""
AWS profile name. Defaults to the content of AWS_PROFILE, then to 'default-ops-912306251540'
if not set. This profile comes from the internal AWS setup.""",
)
@click.option(
    "--s3-cache",
    "-s",
    type=click.Path(file_okay=False, path_type=Path, resolve_path=True),
    default=None,
)
@click.option("--bucket", "-b", default="osrd-dev", type=str)
@click.argument("trace-id")
def main(profile: str | None, s3_cache: Path | None, bucket: str, trace_id: str):
    if s3_cache is None:
        s3_cache = Path(__file__).resolve().parent / ".s3_cache"
    if profile is None:
        profile = os.environ.get("AWS_PROFILE", default="default-ops-912306251540")

    session = create_aws_session(profile)
    s3 = session.client("s3")
    file = download_s3_file(
        s3,
        bucket,
        f"stdcm/requests/{trace_id}/output_simulation_data.json",
        s3_cache,
    )
    subprocess.check_call(f"uv run generate-debug-space-chart.py -i {file}".split())


if __name__ == "__main__":
    main()
