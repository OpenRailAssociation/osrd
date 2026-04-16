import asyncio

import aiohttp
import json
from typing import Dict

import click
from dotenv import load_dotenv

from common import get_paginated, make_connector


async def download_timetable(
    timetable_id: int,
    editoast_url: str,
    page_size: int,
    gateway_cookie: str,
    max_train_count: int,
) -> Dict:
    paced_trains_url = f"{editoast_url}api/timetable/{timetable_id}/train_schedules/?page=$page&{page_size=}"
    cookies, connector = make_connector(gateway_cookie)
    async with aiohttp.ClientSession(
        trust_env=True, raise_for_status=True, cookies=cookies, connector=connector
    ) as session:
        raw_paced_trains = await get_paginated(paced_trains_url, session)
    raw_paced_trains.sort(key=lambda train: train["start_time"])
    if max_train_count > 0:
        raw_paced_trains = raw_paced_trains[:max_train_count]
    paced_trains = []
    for paced_train in raw_paced_trains:
        del paced_train["id"]
        del paced_train["train_schedule_set_id"]
        paced_trains.append(paced_train)
    return {
        "train_schedules": [],
        "paced_trains": paced_trains,
    }


@click.command(
    help="""
Downloads a full timetable into a json file that can be reimported in OSRD operational studies.
"""
)
@click.option("--editoast-url", "-e", default="https://dev-osrd.reseau.sncf.fr/")
@click.option("--timetable-id", "-t", required=True, type=int)
@click.option("--path", "-p", default="timetable.json")
@click.option("--gateway-cookie", "-c", envvar="GATEWAY_COOKIE")
@click.option("--page-size", "-s", default=100)
@click.option(
    "--max-train-count",
    "-m",
    default=0,
    help="""
Maximum number of train to export, to avoid issues with uploading large files.
Trains are sorted by departure time before being trimmed (earliest ones are kept).
""",
)
def main(editoast_url, timetable_id, path, gateway_cookie, page_size, max_train_count):
    trains = asyncio.run(
        download_timetable(
            timetable_id, editoast_url, page_size, gateway_cookie, max_train_count
        )
    )
    with open(path, "w", encoding="utf-8") as jsonfile:
        json.dump(trains, jsonfile, ensure_ascii=False, indent=4)
    print(f"dumped timetable {timetable_id} to {path}")
    print(
        f"{len(trains['train_schedules'])} trains, {len(trains['paced_trains'])} paced trains"
    )


if __name__ == "__main__":
    load_dotenv()
    main()
