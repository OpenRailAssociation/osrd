#! /usr/bin/env -S uv run --script
# This script can be used to download the requirements in a timetable,
# used to reproduce stdcm requests.
# `uv run download_stdcm_requirements.py` handles all the dependencies with the following block:
#
# /// script
# dependencies = ["click", "aiohttp"]
# ///
import asyncio
import json
import ssl
from typing import List, Dict

import click
import aiohttp
from aiohttp import ClientSession


@click.command()
@click.option("--editoast-url", "-e", default="https://osrd.reseau.sncf.fr/")
@click.option("--timetable-id", "-t", required=True, type=int)
@click.option("--infra-id", "-i", required=True, type=int)
@click.option("--path", "-p", default="requirements.json")
@click.option("--gateway-cookie", "-c", envvar="GATEWAY_COOKIE")
@click.option("--page-size", "-s", default=100)
def main(*args, **kwargs):
    asyncio.run(async_main(*args, **kwargs))


async def async_main(
    editoast_url, timetable_id, infra_id, path, gateway_cookie, page_size
):
    url = f"{editoast_url}api/timetable/{timetable_id}/requirements/?page=$page&{page_size=}&{infra_id=}"
    if gateway_cookie is not None:
        cookies = {"gateway": gateway_cookie}
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        connector = aiohttp.TCPConnector(ssl=ssl_context)
    else:
        cookies = None
        connector = None
    async with aiohttp.ClientSession(
        trust_env=True, raise_for_status=True, cookies=cookies, connector=connector
    ) as session:
        requirements = await get_paginated(url, session)
    with open(path, "w", encoding="utf-8") as jsonfile:
        json.dump(requirements, jsonfile, ensure_ascii=False)
    print(
        f"dumped requirements from timetable {timetable_id} ({len(requirements)} values) to {path}"
    )


async def get_with_retries(
    session: aiohttp.ClientSession, url: str, n_retries: int = 5
) -> dict:
    retry = 0
    while True:
        try:
            async with session.get(url) as response:
                return await response.json()
        except aiohttp.ClientResponseError as e:
            if e.status // 100 == 5 and retry < n_retries:
                retry += 1
                print(f"http error, trying again in a few seconds: {e}")
                await asyncio.sleep(10.0)
            else:
                raise e


async def get_paginated(
    url: str, session: ClientSession, n_workers: int = 5
) -> List[Dict]:
    initial_url = url.replace("$page", "1")
    print("downloading first page")
    initial_response = await get_with_retries(session, initial_url)
    page_count = initial_response["page_count"]
    print(f"first page done, {page_count} total pages")

    semaphore = asyncio.Semaphore(n_workers)

    async def fetch_page(page):
        async with semaphore:
            url_page = url.replace("$page", str(page))
            print(f"downloading page {page}/{page_count}")
            json_response = await get_with_retries(session, url_page)
            return json_response["results"]

    all_pages = list(range(2, page_count + 1))
    tasks = [fetch_page(page) for page in all_pages]
    page_contents = await asyncio.gather(*tasks)

    res = initial_response["results"]
    for page_content in page_contents:
        res += page_content
    return res


if __name__ == "__main__":
    main()
