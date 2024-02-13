import json

import tqdm


print("opening file")
with open("data/infras/tiny_infra/infra.json") as f:
    rjs = json.load(f)

print("computing waypoint_to_track")
waypoint_to_track = {}
for waypoint in rjs["buffer_stops"]:
    waypoint_to_track[waypoint["id"]] = waypoint["track"]
for waypoint in rjs["detectors"]:
    waypoint_to_track[waypoint["id"]] = waypoint["track"]

print("computing track_endpoint_to_switch")
track_endpoint_to_switch = {}
for switch in rjs["switches"]:
    for port in switch["ports"].values():
        track_endpoint_to_switch[(port["track"], port["endpoint"])] = switch["id"]

print("computing switches")
switches = {}
for switch in rjs["switches"]:
    switches[switch["id"]] = switch

print("computing route_to_track_sections")
route_to_track_sections = {}
for route in rjs["routes"]:
    tracks = []
    entry = route["entry_point"]["id"]
    track = waypoint_to_track[entry]
    tracks.append(track)
    direction = route["entry_point_direction"]
    while waypoint_to_track[route["exit_point"]["id"]] != track:
        endpoint = "BEGIN" if direction == "STOP_TO_START" else "END"
        switch = track_endpoint_to_switch[(track, endpoint)]
        switch_direction = route["switches_directions"][switch]
        switch = switches[switch]
        if switch["switch_type"] == "point_switch":
            p1, p2 = switch_direction.split("_")
            for port in p1, p2:
                if switch["ports"][port]["track"] != track:
                    track = switch["ports"][port]["track"]
                    tracks.append(track)
                    direction = "START_TO_STOP" if switch["ports"][port]["endpoint"] == "BEGIN" else "STOP_TO_START"
                    break
        elif switch["switch_type"] == "link":
            for port in "A", "B":
                if switch["ports"][port]["track"] != track:
                    track = switch["ports"][port]["track"]
                    tracks.append(track)
                    direction = "START_TO_STOP" if switch["ports"][port]["endpoint"] == "BEGIN" else "STOP_TO_START"
                    break
        elif switch["switch_type"] == "crossing":
            for port in "A1", "B1", "A2", "B2":
                if switch["ports"][port]["track"] == track:
                    if "A" in port:
                        port = port.replace("A", "B")
                    else:
                        port = port.replace("B", "A")
                    track = switch["ports"][port]["track"]
                    tracks.append(track)
                    direction = "START_TO_STOP" if switch["ports"][port]["endpoint"] == "BEGIN" else "STOP_TO_START"
                    break
        elif switch["switch_type"] == "double_slip_switch":
            p1, p2 = switch_direction.split("_")
            for port in p1, p2:
                if switch["ports"][port]["track"] != track:
                    track = switch["ports"][port]["track"]
                    tracks.append(track)
                    direction = "START_TO_STOP" if switch["ports"][port]["endpoint"] == "BEGIN" else "STOP_TO_START"
                    break
        else:
            # TODO: single slip
            print(switch["switch_type"])
            raise NotImplementedError
    route_to_track_sections[route["id"]] = tracks

print("subsets")
for route1, ts1 in tqdm.tqdm(route_to_track_sections.items()):
    lts1 = len(ts1)
    if lts1 <= 1:
        continue
    for route2, ts2 in route_to_track_sections.items():
        if route1 == route2:
            continue
        # TODO: might need some optimization
        for i in range(len(ts2) - lts1 + 1):
            if ts2[i:i+lts1] == ts1:
                print(route1, route2)
                print(ts1)
                print(ts2)
