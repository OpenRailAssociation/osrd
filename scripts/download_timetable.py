#
# This script can be used to download the content of a timetable knowing only its ID,
# as a JSON file that can be re-imported in OSRD.
#

import requests
import json
from typing import Dict, List

EDITOAST_URL = "https://rec-osrd.reseau.sncf.fr/"
COOKIES = {
    # Connect to the front-end and look through the "cookies" part of any sent request
    "gateway" : ""
}
TIMETABLE_ID = 1
OUT_PATH = "timetable.json"


def get_paginated(url: str, *args, **kwargs) -> List[Dict]:
    page = 1
    res = []
    while page is not None:
        try:
            response = requests.get(url.replace("$page", str(page)), *args, **kwargs)
            response.raise_for_status()
            json_response = response.json()
            res += json_response["results"]
            page = json_response.get("next", None)
        except Exception as e:
            print(e)
            time.sleep(1)
    return res


def download_timetable(timetable_id: int) -> Dict:
    train_schedules_url = f"{EDITOAST_URL}api/timetable/{timetable_id}/train_schedules/?page=$page"
    paced_trains_url = f"{EDITOAST_URL}api/timetable/{timetable_id}/paced_trains/?page=$page"
    raw_schedules = get_paginated(train_schedules_url, cookies=COOKIES, verify=False)
    raw_paced_trains = get_paginated(paced_trains_url, cookies=COOKIES, verify=False)
    schedules = []
    paced_trains = []
    for schedule in raw_schedules:
        del schedule["id"]
        del schedule["timetable_id"]
        schedules.append(schedule)
    for paced_train in raw_paced_trains:
        del paced_train["id"]
        del paced_train["timetable_id"]
        paced_trains.append(paced_train)
    return {
        "train_schedules": schedules,
        "paced_trains":paced_trains,
    }


if __name__ == "__main__":
    trains = download_timetable(TIMETABLE_ID)
    with open(OUT_PATH, "w", encoding="utf-8") as jsonfile:
        json.dump(trains, jsonfile, ensure_ascii=False, indent=4)
    print(f"dumped timetable {TIMETABLE_ID} to {OUT_PATH}")
    print(f"{len(trains['train_schedules'])} trains, {len(trains['paced_trains'])} paced trains")
