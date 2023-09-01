import json
import requests
from requests import Response
from pathlib import Path
from fuzzer import make_valid_path, make_payload_path, post_with_timeout, make_graph, INFRA_ID, URL, EDITOAST_URL

# used for coloring the terminal output
RESET = "\033[0m"
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"

# how many tests to run
N_ITERATIONS = 10


def compare_pathfindings(iterations: int):
    print("Making Graph...")
    infra_graph = make_graph(URL, INFRA_ID)
    print("Done !")
    print("Loading Infra...")
    requests.post(EDITOAST_URL + f"infra/{INFRA_ID}/load").raise_for_status()
    print("Done !")
    # initialize it to give stats in the end
    stats = {
        'ok': [],
        'not_ok': [],
        'status_code_problem': [],
        'path_found_ok': [],
        'path_found_not_ok': [],
        'slopes_problem': [],
        'curves_problem': [],
        'geos_problem': [],
        'steps_problem': [],
        'length_problem': [],
        'routes_shorter': [],
        'blocks_shorter': [],
    }

    # used to deliver the stats in a more verbal way
    stats_print = {
        'ok': 'Tests passed',
        'not_ok': 'Different responses',
        'status_code_problem': 'Different status codes',
        'path_found_ok': 'Path were founds and were equal',
        'path_found_not_ok': 'Path were founds and were different',
        'length_problem': 'Different lengths',
        'slopes_problem': 'Different slopes',
        'curves_problem': 'Different curves',
        'geos_problem': 'Different Geos',
        'steps_problem': 'Different Steps',
        'routes_shorter': 'Path found by routes was shorter',
        'blocks_shorter': 'path found by blocks was shorter',
    }

    current_directory = Path()
    path_to_all_logs = current_directory / "logs"
    path_to_all_logs.mkdir(exist_ok=True)

    max_log_id = 0
    for log_file in path_to_all_logs.iterdir():
        log_id = int(log_file.name)
        if log_id > max_log_id:
            max_log_id = log_id
    current_log_id = max_log_id + 1

    path_to_logs = path_to_all_logs / str(current_log_id)
    path_to_logs.mkdir(exist_ok=True)

    for i in range(0, iterations):
        compare_pathfinding(infra_graph, stats, i, path_to_logs)

    print("\n------------- Stats Recap --------------\n")
    for stat in stats:
        if stat != 'ok':
            print(f"{stats_print[stat]}: {len(stats[stat])}")
            if len(stats[stat]) > 0:
                print(stats[stat])
            print('')

    if len(stats['ok']) != N_ITERATIONS:
        print(
            f"{RED}{len(stats['not_ok'])} errors :'( " +
            f"@Eckter @Erashin @Anisometropie looks like mon départ ne vous réussit pas{RESET}"
        )
    else:
        print(f"{GREEN}0 errors !!! GG, also big thanks to the comparison script for all this helpful help{RESET}")
    print(f"\nIn order to rerun a specific test, run 'compare_specific_log({current_log_id}, #testNumber)'\n")


def compare_pathfinding(infra_graph, stats, iteration, path_to_logs):
    path, _ = make_valid_path(infra_graph)
    path_payload = make_payload_path(INFRA_ID, path)
    path_payload_routes = path_payload.copy()
    path_payload_routes["routes_or_blocks"] = "routes"
    path_payload_blocks = path_payload.copy()
    path_payload_blocks["routes_or_blocks"] = "blocks"
    routes_result: Response = post_with_timeout(URL + "pathfinding/", json=path_payload_routes)
    blocks_result: Response = post_with_timeout(URL + "pathfinding/", json=path_payload_blocks)

    if routes_result.status_code != blocks_result.status_code:
        stats['not_ok'].append(iteration)
        stats['status_code_problem'].append(iteration)
        f = open(f"{path_to_logs}/{iteration}", 'w')
        f.write(json.dumps(path_payload))
        f.close()
        print(
            f"{iteration}: {RED}ERROR{RESET} Different status code," +
            f"routes: {routes_result.status_code} blocks: {blocks_result.status_code}"
        )
        print_path_payload(path_payload_routes)
    elif routes_result.status_code // 100 != 2:
        stats['ok'].append(iteration)
        print(f"{iteration}: {GREEN}OK {RESET}, Both have status code: {routes_result.status_code}")
    else:
        routes_path = json.loads(routes_result.content.decode())
        blocks_path = json.loads(blocks_result.content.decode())
        if compare_paths(routes_path, blocks_path, path_payload_routes, stats, iteration):
            stats['ok'].append(iteration)
            stats['path_found_ok'].append(iteration)
        else:
            stats['not_ok'].append(iteration)
            stats['path_found_not_ok'].append(iteration)
            f = open(f"{path_to_logs}/{iteration}", 'w')
            f.write(json.dumps(path_payload))
            f.close()


def compare_paths(routes_path, blocks_path, path_payload, stats, iteration):
    class Comparison:
        def __init__(self, value_name, value_getter, comparison_function, print_function, error_name):
            self.value_name = value_name
            self.value_getter = value_getter
            self.comparison_function = comparison_function
            self.print_function = print_function
            self.error_name = error_name
            self.log = ""
            self.result = None

    length = Comparison('Length', None, None, None, 'length_problem')
    slope = Comparison('Slope', lambda x: x['slopes'], compare_slope, print_slope, 'slopes_problem')
    curve = Comparison('Curve', lambda x: x['curves'], compare_curve, print_curve, 'curves_problem')
    geo = Comparison('Geo', lambda x: x['geographic']['coordinates'], compare_geo, print_geo, 'geos_problem')
    step = Comparison('Step', lambda x: x['steps'], compare_step, print_step, 'steps_problem')

    comparisons = [length, slope, curve, geo, step]

    # some dots in the geos are aligned and create errors while representing the same broken line.
    # This treatment prevents it.
    geo_pretreatment(routes_path['geographic']['coordinates'])
    geo_pretreatment(blocks_path['geographic']['coordinates'])

    # lengths' comparison is different from others comparisons, so it's done aside
    length.result, length.log = compare_lengths(routes_path, blocks_path, stats, iteration)

    for comparison in comparisons:
        if comparison != length:
            comparison.result, comparison.log = compare_values(comparison.value_name,
                                                               comparison.value_getter(routes_path),
                                                               comparison.value_getter(blocks_path),
                                                               comparison.comparison_function,
                                                               comparison.print_function)

    if False not in [comparison.result for comparison in comparisons]:
        print(f"{iteration}: {GREEN}OK{RESET}, Both Paths are the same")
        return True
    else:
        print(f"{iteration}: {RED}ERROR{RESET}, difference in the paths")
        for comp in comparisons:
            if comp.result:
                print(f"{comp.value_name}s: OK")
            else:
                stats[comp.error_name].append(iteration)
                print(f"{comp.value_name}s: ERROR")
        print_path_payload(path_payload)
        for comp in comparisons:
            print(comp.log, end='')


def geo_pretreatment(geos):
    i = 1
    while i < len(geos) - 1:
        x1, y1 = geos[i - 1][0], geos[i - 1][1]
        x2, y2 = geos[i][0], geos[i][1]
        x3, y3 = geos[i + 1][0], geos[i + 1][1]
        slope1 = (y3 - y2) * (x2 - x1)
        slope2 = (y2 - y1) * (x3 - x2)
        # not sur about the acceptable precision for the difference in the slopes
        if slope1 - 0.000001 < slope2 < slope1 + 0.000001:  # checks if the dots are aligned
            geos.pop(i)
        else:
            i += 1


def compare_lengths(routes_path, blocks_path, stats, iteration):
    if compare_with_lease(routes_path["length"], blocks_path["length"]):
        return True, ""
    else:
        stats['routes_shorter' if routes_path["length"] < blocks_path["length"] else 'blocks_shorter'].append(iteration)
        logs = ("--------------  Length Comparison Information  -------------------\n"
                f"routes length: {round(routes_path['length'], 3)}\n"
                f"blocks length: {blocks_path['length']}\n")
        return False, logs


def compare_values(value_name, routes_values, blocks_values, comparison_function, print_function):
    i = 0
    len_routes_values = len(routes_values)
    len_blocks_values = len(blocks_values)
    min_len = min(len_routes_values, len_blocks_values)
    while i < min_len and comparison_function(routes_values[i], blocks_values[i]):
        i += 1
    if i == len_blocks_values == len_routes_values:
        return True, ""
    else:
        logs = f"-------------- {value_name} Comparison Information  -------------------\n\n"
        for j in range(i):
            logs += f"{value_name} {j}: same values, {print_function(routes_values[j])}\n"
        logs += f"From {value_name} {i} they start to diverge\n"

        logs += "\nroutes:\n"
        if i == len_routes_values:
            logs += f"      routes path finished at {value_name} {i - 1}\n"
        else:
            for j in range(i, len_routes_values):
                logs += f"  {value_name} {j}: {print_function(routes_values[j])}\n"

        logs += "\nblocks:\n"
        if i == len_blocks_values:
            logs += f"      blocks path finished at {value_name} {i - 1}\n"
        else:
            for j in range(i, len_blocks_values):
                logs += f"  {value_name} {j}: {print_function(blocks_values[j])}\n"
        logs += '\n'
    return False, logs


def compare_slope(routes_slope, blocks_slope):
    return routes_slope['gradient'] == blocks_slope['gradient'] and compare_with_lease(routes_slope['position'],
                                                                                       blocks_slope['position'])


def print_slope(slope):
    return f"gradient {slope['gradient']} at position {round(slope['position'], 3)}"


def compare_curve(routes_curve, blocks_curve):
    return routes_curve['radius'] == blocks_curve['radius'] and compare_with_lease(routes_curve['position'],
                                                                                   blocks_curve['position'])


def print_curve(curve):
    return f"radius {curve['radius']} at position {round(curve['position'], 3)}"


def compare_geo(routes_geo, blocks_geo):
    return compare_with_lease(routes_geo[0], blocks_geo[0]) and compare_with_lease(routes_geo[1], blocks_geo[1])


def print_geo(geo):
    return f"({round(geo[0], 3)},{round(geo[1], 3)})"


def compare_step(routes_step, blocks_step):
    routes_coordinates = routes_step['geo']['coordinates']
    blocks_coordinates = blocks_step['geo']['coordinates']
    return compare_with_lease(routes_coordinates[0], blocks_coordinates[0]) and \
        compare_with_lease(routes_coordinates[1], blocks_coordinates[1]) and \
        compare_with_lease(routes_step['path_offset'], blocks_step['path_offset']) and \
        compare_with_lease(routes_step['location']['offset'], blocks_step['location']['offset']) and \
        routes_step['location']['track_section'] == blocks_step['location']['track_section'] and \
        routes_step['id'] == blocks_step['id'] and \
        routes_step['name'] == blocks_step['name']


def print_step(step):
    # not sure that printing information about the id/name of the waypoint is very useful, so I prefer not adding noise
    track_offset = round(step['location']['offset'], 3)
    track_section = step['location']['track_section']
    path_offset = round(step['path_offset'], 3)
    x = round(step['geo']['coordinates'][0], 3)
    y = round(step['geo']['coordinates'][1], 3)
    return f"offset {track_offset} on track section {track_section}. path offset: {path_offset}. geos: ({x},{y})"


def print_path_payload(payload):
    print("--------------  Given Payload  -------------------")
    print(f"infra: {payload['infra']}")
    print(f"name: {payload['name']}")
    steps = payload['steps']
    for i in range(len(steps)):
        print(
            f"step {i}: offset {round(steps[i]['waypoints'][0]['offset'], 3)} " +
            f"on track {steps[i]['waypoints'][0]['track_section']}"
        )
    print('')


def compare_with_lease(a, b):
    # maybe we should use 0.002 instead of 0.001, but I'm not sure about what degree of precision we want
    return a - 0.001 <= b <= a + 0.001


# Allows to replay a specific log
def compare_specific_log(log, iteration):
    current_directory = Path()
    iteration = current_directory / "logs" / str(log) / str(iteration)
    f = open(iteration, 'r')
    json_payload = f.read()
    compare_specific_payload(json.loads(json_payload))


def compare_specific_payload(payload):
    stats = {
        'ok': [],
        'not_ok': [],
        'status_code_problem': [],
        'path_found_ok': [],
        'path_found_not_ok': [],
        'slopes_problem': [],
        'curves_problem': [],
        'geos_problem': [],
        'steps_problem': [],
        'same_length_diff_steps': [],
        'length_problem': [],
        'routes_shorter': [],
        'blocks_shorter': [],
    }
    iteration = 0
    # stats and iteration are necessary because of a conception mistake that I made and a lack of time sorry :'(
    path_payload_routes = payload.copy()
    path_payload_routes["routes_or_blocks"] = "routes"
    path_payload_blocks = payload.copy()
    path_payload_blocks["routes_or_blocks"] = "blocks"

    routes_result: Response = post_with_timeout(URL + "pathfinding/", json=path_payload_routes)
    blocks_result: Response = post_with_timeout(URL + "pathfinding/", json=path_payload_blocks)
    if routes_result.status_code != blocks_result.status_code:
        print(
            f"{RED}ERROR{RESET}, Different status code," +
            f"routes: {routes_result.status_code} blocks: {blocks_result.status_code}"
        )
        print_path_payload(path_payload_routes)
    elif routes_result.status_code // 100 != 2:
        print(f"{GREEN}OK{RESET}, Both have status code: {routes_result.status_code}")
    else:
        routes_path = json.loads(routes_result.content.decode())
        blocks_path = json.loads(blocks_result.content.decode())
        compare_paths(routes_path, blocks_path, path_payload_routes, stats, iteration)


if __name__ == "__main__":
    # compare_specific_log(logfile, iteration)
    compare_pathfindings(N_ITERATIONS)
