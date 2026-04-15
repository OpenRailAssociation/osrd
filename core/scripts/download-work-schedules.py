import asyncio

import aiohttp
import json
from typing import List, Dict

import click
from dotenv import load_dotenv

from common import get_paginated, make_connector


async def download_work_schedules(
    group_id: int,
    editoast_url: str,
    page_size: int,
    gateway_cookie: str,
) -> List[Dict]:
    url = f"{editoast_url}api/work_schedules/group/{group_id}/?page=$page&{page_size=}"
    cookies, connector = make_connector(gateway_cookie)
    async with aiohttp.ClientSession(
        trust_env=True, raise_for_status=True, cookies=cookies, connector=connector
    ) as session:
        return await get_paginated(url, session)


@click.command(
    help="""
Downloads a full work schedule group.
"""
)
@click.option("--editoast-url", "-e", default="https://dev-osrd.reseau.sncf.fr/")
@click.option("--group-id", "-g", required=True, type=int)
@click.option("--path", "-p", default="work_schedules.json")
@click.option("--gateway-cookie", "-c", envvar="GATEWAY_COOKIE")
@click.option("--page-size", "-s", default=100)
def main(editoast_url, group_id, path, gateway_cookie, page_size):
    work_schedules = asyncio.run(
        download_work_schedules(group_id, editoast_url, page_size, gateway_cookie)
    )
    with open(path, "w", encoding="utf-8") as jsonfile:
        json.dump(work_schedules, jsonfile, ensure_ascii=False, indent=4)
    print(
        f"dumped work schedule group {group_id} to {path} ({len(work_schedules)} work schedules)"
    )


if __name__ == "__main__":
    load_dotenv()
    main()
