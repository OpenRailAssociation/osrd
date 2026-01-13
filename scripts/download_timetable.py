#! /usr/bin/env -S uv run --script
#
# This script can be used to download the content of a timetable knowing only its ID,
# as a JSON file that can be re-imported in OSRD.
#
# /// script
# dependencies = ["click", "aiohttp"]
# ///
import asyncio

import aiohttp
import json
from typing import Dict

from download_stdcm_requirements import get_paginated, make_connector

EDITOAST_URL = "https://rec-osrd.reseau.sncf.fr/"
COOKIES = {
    # Connect to the front-end and look through the "cookies" part of any sent request
    "gateway" : ""
}
TIMETABLE_ID = 1
OUT_PATH = "timetable.json"


async def download_timetable(timetable_id: int) -> Dict:
    paced_trains_url = f"{EDITOAST_URL}api/timetable/{timetable_id}/paced_trains/?page=$page"
    cookies, connector = make_connector(COOKIES["gateway"])
    async with aiohttp.ClientSession(
        trust_env=True, raise_for_status=True, cookies=cookies, connector=connector
    ) as session:
        raw_paced_trains = await get_paginated(paced_trains_url, session)
    paced_trains = []
    for paced_train in raw_paced_trains:
        del paced_train["id"]
        del paced_train["timetable_id"]
        paced_trains.append(paced_train)
    return {
        "train_schedules": [],
        "paced_trains":paced_trains,
    }


if __name__ == "__main__":
    trains = asyncio.run(download_timetable(TIMETABLE_ID))
    with open(OUT_PATH, "w", encoding="utf-8") as jsonfile:
        json.dump(trains, jsonfile, ensure_ascii=False, indent=4)
    print(f"dumped timetable {TIMETABLE_ID} to {OUT_PATH}")
    print(f"{len(trains['train_schedules'])} trains, {len(trains['paced_trains'])} paced trains")
