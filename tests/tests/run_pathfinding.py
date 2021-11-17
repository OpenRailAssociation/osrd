import json
import requests


def get_track_section(base_url, infra_id):
    response = requests.get(base_url + f"infra/{infra_id}/railjson/")
    infra = response.json()
    track_id = infra["track_sections"][0]["id"]
    return int(track_id.split(".")[1])


def run_pathfinding(base_url, infra_id):
    track_id = get_track_section(base_url, infra_id)
    path_payload = {
        "infra": infra_id,
        "name": "foo",
        "steps": [
            {
                "stop_time": 0,
                "waypoints": [
                    {
                        "track_section": track_id,
                        "offset": 0
                    }
                ]
            },
            {
                "stop_time": 0,
                "waypoints": [
                    {
                        "track_section": track_id,
                        "offset": 1000
                    }
                ]
            }
        ]

    }
    r = requests.post(base_url + "pathfinding/", json=path_payload)
    if r.status_code // 100 != 2:
        raise RuntimeError(f"Pathfinding error {r.status_code}: {r.content}, payload={json.dumps(path_payload)}")
    return r.json()["id"]


def run(*args, **kwargs):
    base_url = kwargs["url"]
    infra_id = kwargs["infra_id"]
    run_pathfinding(base_url, infra_id)
    return True, ""
