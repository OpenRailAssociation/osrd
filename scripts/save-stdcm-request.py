#! /usr/bin/env -S uv run --script
# This script can be used to download all files required to reproduce a past stdcm request (core part only),
# Meant to be used as `uv run save-stdcm-request.py`, or directly as an executable file.
#
# /// script
# dependencies = ["click", "aiohttp", "pathlib"]
# ///
import asyncio
import datetime
import json
import ssl
import sys
from pathlib import Path
from typing import Dict, Any

import click
import aiohttp
from aiohttp import ClientSession

from download_stdcm_requirements import get_paginated


@click.command()
@click.option("--editoast-url", "-e", type=str, default="https://osrd.reseau.sncf.fr/")
@click.option(
    "--span-attributes",
    "-a",
    default=sys.stdin,
    type=click.File("r"),
    help="Span attributes, copied from the web UI as json. Defaults to stdin.",
)
@click.option(
    "--infra-id",
    "-i",
    type=int,
    help="Infra ID, only used if not set in the span attributes. Query parameter of /stdcm endpoint.",
)
@click.option(
    "--timetable-id",
    "-t",
    type=int,
    help="Timetable ID, only used if not set in the span attributes. Path parameter of /stdcm endpoint.",
)
@click.option(
    "--timetable-dir",
    "-d",
    type=click.Path(file_okay=False, path_type=Path),
    default="timetables",
    help="Location to save the timetable files. Will not download a timetable if already there.",
)
@click.option(
    "--gateway-cookie",
    "-c",
    type=str,
    envvar="GATEWAY_COOKIE",
    help="Gateway cookie, can be used to access internal environments. Can be passed as an env var.",
)
@click.option(
    "--core-request-file",
    "-o",
    type=str,
    help="File location to save the core stdcm payload, default to current timestamp.",
)
@click.option(
    "--n-threads",
    "-n",
    type=int,
    help="Number of threads to use in parallel to download timetable requirements.",
    default=5,
)
@click.option("--page-size", "-s", type=int, default=100)
def main(*args, **kwargs):
    asyncio.run(async_main(*args, **kwargs))


async def async_main(
    editoast_url,
    span_attributes,
    infra_id,
    timetable_id,
    timetable_dir,
    gateway_cookie,
    core_request_file,
    n_threads,
    page_size,
):
    aiohttp_params: Dict[str, Any] = {
        "trust_env": True,
        "raise_for_status": False,
    }
    if gateway_cookie is not None:
        cookies = {"gateway": gateway_cookie}
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        connector = aiohttp.TCPConnector(ssl=ssl_context)
        aiohttp_params["cookies"] = cookies
        aiohttp_params["connector"] = connector

    print("Reading span attributes...")
    if span_attributes is sys.stdin:
        print("No file has been set, dump the json into stdin:")
    span_attributes = json.load(span_attributes)
    timetable_id = span_attributes.get("timetable_id", timetable_id)
    assert timetable_id is not None, (
        "missing timetable id in both span attributes and cli parameters"
    )
    infra_id = span_attributes.get("infra_id", infra_id)
    assert infra_id is not None, (
        "missing infra id in both span attributes and cli parameters"
    )

    print(f"Using infra id {infra_id} and timetable id {timetable_id}.")

    if "request" in span_attributes:
        input_payload = json.loads(span_attributes["request"])
    elif "steps" in span_attributes:
        # We can also accept the payload directly
        input_payload = span_attributes
    else:
        raise RuntimeError("Missing input payload")

    if core_request_file is None:
        core_request_file = datetime.datetime.now().strftime(
            "core-stdcm-payload-%Y-%m-%d_%H-%M-%S.json"
        )
    core_request_file = Path(core_request_file)

    timetable_dir.mkdir(exist_ok=True)

    async with aiohttp.ClientSession(**aiohttp_params) as session:
        timetable_coroutine = save_timetable(
            timetable_dir,
            editoast_url,
            timetable_id,
            page_size,
            infra_id,
            n_threads,
            session,
        )
        payload_coroutine = save_core_payload(
            editoast_url,
            timetable_id,
            infra_id,
            input_payload,
            core_request_file,
            session,
        )
        await asyncio.gather(payload_coroutine, timetable_coroutine)


async def save_timetable(
    timetable_dir: Path,
    editoast_url: str,
    timetable_id: int,
    page_size: int,
    infra_id: int,
    n_threads: int,
    session: ClientSession,
):
    timetable_file = timetable_dir / f"{timetable_id}.json"
    if timetable_file.is_file():
        print(f"Timetable already saved at {timetable_file}")
    else:
        print("Downloading requirements...")
        requirements_url = f"{editoast_url}api/timetable/{timetable_id}/requirements/?page=$page&{page_size=}&{infra_id=}"
        requirements = await get_paginated(requirements_url, session, n_threads)
        with open(timetable_file, "w", encoding="utf-8") as jsonfile:
            json.dump(requirements, jsonfile)
        print(
            f"Saved requirements from timetable {timetable_id} ({len(requirements)} trains) to {timetable_file}"
        )


async def save_core_payload(
    editoast_url: str,
    timetable_id: int,
    infra_id: int,
    input_payload: Dict,
    save_into: Path,
    session: ClientSession,
):
    url = f"{editoast_url}api/timetable/{timetable_id}/stdcm?infra={infra_id}&return_debug_payloads=true"
    async with session.post(url, json=input_payload) as response:
        json_response = await response.json()
        if "core_payload" in json_response:
            core_payload = json_response["core_payload"]
        elif "context" in json_response and "core_payload" in json_response["context"]:
            core_payload = json_response["context"]["core_payload"]
        else:
            raise RuntimeError(f"error in core response: {json_response}")
        with open(save_into, "w", encoding="utf-8") as jsonfile:
            json.dump(core_payload, jsonfile)
        print(f"Saved core payload to {save_into}")


if __name__ == "__main__":
    main()
