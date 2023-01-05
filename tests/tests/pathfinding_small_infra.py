import json

import requests


def get_track_section(base_url, infra_id):
    response = requests.get(base_url + f"infra/{infra_id}/railjson/")
    infra = response.json()
    return infra["track_sections"][0]


def run_pathfinding(base_url, infra_id):
    path_payload = {
        "infra": infra_id,
        "steps": [
            {
                "duration": 0,
                "waypoints": [
                    {
                        "track_section": "TE1",
                        "offset": 0,
                    }
                ],
            },
            {
                "duration": 0,
                "waypoints": [
                    {
                        "track_section": "TE0",
                        "offset": 0,
                    }
                ],
            },
        ],
    }
    r = requests.post(base_url + "pathfinding/", json=path_payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(
            f"Pathfinding error {r.status_code}: {r.content}, payload={json.dumps(path_payload)}"
        )
    return r.json()["id"]


def run(*args, **kwargs):
    base_url = kwargs["url"]
    infra_id = kwargs["all_scenarios"]["small_infra"].infra
    run_pathfinding(base_url, infra_id)
    return True, ""
