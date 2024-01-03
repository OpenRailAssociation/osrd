#!/usr/bin/env python3

import json
from pathlib import Path
from sys import argv
from typing import Dict, List

OBJECT_TYPES = {
    "OperationalPoint": "operational_points",
    "Route": "routes",
    "SwitchType": "extended_switch_types",
    "Switch": "switches",
    "TrackSection": "track_sections",
    "SpeedSection": "speed_sections",
    "Electrification": "electrifications",
    "Signal": "signals",
    "BufferStop": "buffer_stops",
    "Detector": "detectors",
    "NeutralSection": "neutral_sections",
}


def del_payload(obj_type: str, obj_id: str) -> Dict:
    """
    Create the payload to indicate that an object must be deleted
    """
    return {
        "operation_type": "DELETE",
        "obj_type": obj_type,
        "obj_id": obj_id,
    }


def create_payload(obj_type: str, value: Dict) -> Dict:
    """
    Create the payload to indicate that an object must be created
    """
    return {
        "operation_type": "CREATE",
        "obj_type": obj_type,
        "railjson": value,
    }


def diff(rjs_old: Dict, rjs_new: Dict) -> List[Dict]:
    """
    Create a diff between rjs_old and rjs_new
    """
    payload = []
    for (obj_type, rjs_key) in OBJECT_TYPES.items():
        objects_old = {o["id"]: o for o in rjs_old[rjs_key]}
        objects_new = {o["id"]: o for o in rjs_new[rjs_key]}
        objects_keys = set(objects_old.keys()).union(objects_new.keys())
        for obj_key in objects_keys:
            # New object
            if obj_key not in objects_old:
                value = objects_new[obj_key]
                payload.append(create_payload(obj_type, value))
                continue
            # Deleted object
            elif obj_key not in objects_new:
                payload.append(del_payload(obj_type, obj_key))
                continue
            value_old = objects_old[obj_key]
            value_new = objects_new[obj_key]
            # Updated object
            if value_old != value_new:
                payload.append(del_payload(obj_type, obj_key))
                payload.append(create_payload(obj_type, value_new))
    return payload


if __name__ == "__main__":
    if len(argv) != 3:
        print(f"usage: {argv[0]} OLD_RAILJSON NEW_RAILJSON")
        exit(1)

    rjs_old = Path(argv[1])
    rjs_new = Path(argv[2])
    if not rjs_old.is_file():
        print(f"File not found '{rjs_old}'")
        exit(1)
    if not rjs_new.is_file():
        print(f"File not found '{rjs_new}'")
        exit(1)

    with rjs_old.open() as f:
        rjs_old = json.load(f)
    with rjs_new.open() as f:
        rjs_new = json.load(f)

    if rjs_old["version"] != rjs_new["version"]:
        raise Exception("Railjson files doesn't have the same version")

    diff_payload = diff(rjs_old, rjs_new)
    print(json.dumps(diff_payload, indent=4))
