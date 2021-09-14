import json
import sys


COPIED_KEYS_V1_TO_V2 = (
    "id",
    "length",
    "max_speed",
    "startup_time",
    "startup_acceleration",
    "comfort_acceleration",
    "gamma",
    "gamma_type",
    "inertia_coefficient",
    "features",
)


def migrate_v1_to_v2(old):
    new = {migrated_key: old[migrated_key] for migrated_key in COPIED_KEYS_V1_TO_V2}

    new["source"] = old["id"]
    new["verbose_name"] = old["id"]
    new["type"] = None
    new["sub_type"] = None
    new["series"] = None
    new["sub_series"] = None
    new["variant"] = None
    new["units_count"] = 1

    new["effort_curves"] = {
        "default_curve": [
            (point["speed"], point["max_effort"])
            for point in old["tractive_effort_curve"]
        ]
    }

    new["effort_curve_profiles"] = {
        "default_curve_profile": [{"condition": None, "effort_curve": "default_curve"}]
    }

    new["rolling_resistance_profiles"] = {
        "default_resistance_profile": [
            {"id": "normal", "condition": None, "resistance": old["rolling_resistance"]}
        ]
    }

    new["liveries"] = []
    new["power_class"] = 5

    new["masses"] = [
        {"id": "default_mass", "load_state": "NORMAL_LOAD", "mass": old["mass"]}
    ]

    new["modes"] = [
        {
            "type": "diesel",
            "rolling_resistance_profile": "default_resistance_profile",
            "effort_curve_profile": "default_curve_profile",
        }
    ]
    return new


def convert_file(fp):
    old = json.load(fp)
    new = migrate_v1_to_v2(old)
    json.dump(new, sys.stdout)


if __name__ == "__main__":
    if len(sys.argv) > 2:
        print("Usage: migrate_rolling_stock [input_file]", file=sys.stderr)
        sys.exit(1)

    if len(sys.argv) == 2:
        with open(sys.argv[1]) as fp:
            convert_file(fp)
    else:
        convert_file(sys.stdin)
