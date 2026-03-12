import json
import os
from pathlib import Path

import click

from common import download_s3_file, create_aws_session


@click.command(
    help="""
Download and print the file detailing conflicts encountered during an stdcm search.
The trace ID refers to datadog traces.
"""
)
@click.argument("trace-id")
@click.option("--profile", "-p", default=None, type=str)
@click.option("--bucket", "-b", default="osrd-dev", type=str)
@click.option("--quiet", "-q", is_flag=True, default=False)
def main(
    trace_id: str,
    profile: str | None,
    bucket: str,
    quiet: bool,
):
    s3_cache = Path(__file__).resolve().parent / ".s3_cache"
    if profile is None:
        profile = os.environ.get("AWS_PROFILE", default="default-ops-912306251540")

    session = create_aws_session(profile)
    s3 = session.client("s3")
    file_path = download_s3_file(
        s3,
        bucket,
        f"stdcm/requests/{trace_id}/failure.json",
        s3_cache,
    )
    if not quiet:
        print(json.dumps(json.load(file_path.open()), indent=2))
    else:
        print(file_path)


if __name__ == "__main__":
    main()
