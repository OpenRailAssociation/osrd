import asyncio
import json

import click
import aiohttp
from dotenv import load_dotenv

from common import make_connector, get_paginated


@click.command(
    help="""
Downloads the requirements in a given timetable.
Generates a json that can be used in core to run stdcm requests,
through the `JsonTimetableProvider` class.
"""
)
@click.option("--editoast-url", "-e", default="https://dev-osrd.reseau.sncf.fr/")
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
    cookies, connector = make_connector(gateway_cookie)
    async with aiohttp.ClientSession(
        trust_env=True, raise_for_status=True, cookies=cookies, connector=connector
    ) as session:
        requirements = await get_paginated(url, session)
    with open(path, "w", encoding="utf-8") as jsonfile:
        json.dump(requirements, jsonfile, ensure_ascii=False)
    print(
        f"dumped requirements from timetable {timetable_id} ({len(requirements)} values) to {path}"
    )


if __name__ == "__main__":
    load_dotenv()
    main()
