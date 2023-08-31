import os
import json
import sys
from pathlib import Path as FilePath
import requests
from requests import Response

sys.path.append(str(FilePath(__file__).parents[1] / "fuzzer"))
from fuzzer import make_valid_path, make_payload_path, post_with_timeout,make_graph, INFRA_ID, URL, EDITOAST_URL

RESET = "\033[0m"
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"

N_ITERATIONS = 100

def compare_pathfindings(iterations: int):
    print("Making Graph...")
    infraGraph = make_graph(URL, INFRA_ID)
    print("Done !")
    print("Loading Infra...")
    requests.post(EDITOAST_URL + f"infra/{INFRA_ID}/load").raise_for_status()
    print("Done !")
    #initialize it to give stats in the end 
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

    stats_print= {
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
        'same_length_diff_steps': 'Paths have the same length but different steps',
        'routes_shorter': 'Path found by routes was shorter',
        'blocks_shorter': 'path found by blocks was shorter',
    }
    
    current_directory = os.path.dirname(os.path.abspath(__file__))
    path_to_logs = os.path.join(current_directory, 'logs')
    
    max_log_id = 0
    for log_name in os.listdir(path_to_logs):
        log_id = int(log_name)
        if log_id > max_log_id:
            max_log_id = log_id
    current_log_id = max_log_id + 1

    path_to_logs = path_to_logs + '/' + str(current_log_id)
    os.mkdir(path_to_logs)

    for i in range(0,iterations):
        compare_pathfinding(infraGraph, stats, i, path_to_logs)

    print("\n------------- Stats Recap --------------\n")
    for stat in stats:
        if stat != 'ok':
            print(f"{stats_print[stat]}: {len(stats[stat])}")
            if len(stats[stat]) > 0:
                print(stats[stat])
            print('')
    
    if len(stats['ok']) != N_ITERATIONS:
        print(RED + f"{len(stats['not_ok'])} errors :'( @Eckter @Erashin @Anisometropie" + RESET)
    else:
        print(GREEN + "GG, also big thanks to the comparison script for all this helpful help" + RESET)
    print(f"\nIn order to rerun a specific test, run 'compare_specific_log({current_log_id}, #testNumber)'\n")

def compare_pathfinding(infraGraph, stats, iteration, path_to_logs):
        path,_ = make_valid_path(infraGraph)
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
            print(f"{iteration}: "+ RED +"ERROR" + RESET + f", Different status code, routes: {routes_result.status_code} blocks: {blocks_result.status_code}")
            print_path_payload(path_payload_routes)
        elif routes_result.status_code // 100 != 2:
            stats['ok'].append(iteration)
            print(f"{iteration}: "+ GREEN +"OK" + RESET + f", Both have status code: {routes_result.status_code}")
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
    value_names = [
                'Length',
                'Slope',
                'Curve',
                'Geo',
                'Step'
    ]
    
    value_getters = [
        None,
        lambda x: x['slopes'],
        lambda x: x['curves'],
        lambda x: x['geographic']['coordinates'],
        lambda x: x['steps']
    ]
           
    comparison_functions = [
        None,
        compare_slope,
        compare_curve,
        compare_geo,
        compare_step
    ]

    print_functions = [
        None,
        print_slope,
        print_curve,
        print_geo,
        print_step
    ]

    error_name = [
        'length_problem',
        'slopes_problem',
        'curves_problem',
        'geos_problem',
        'steps_problem',
    ]

    results = [] #The bools we get from the compairsons
    logs = [] #What we want to be printed if there is a problem

    geo_pretreatment(routes_path['geographic']['coordinates'])
    geo_pretreatment(blocks_path['geographic']['coordinates'])
    #lengths' comparison is different than others comparisons so it's done aside
    result, log = compare_lengths(routes_path, blocks_path, stats, iteration)
    results.append(result)
    logs.append(log)

    for i in range(1,len(value_names)):
        result,log = compare_values(value_names[i], value_getters[i](routes_path), value_getters[i](blocks_path),\
                                     comparison_functions[i], print_functions[i], stats, iteration)
        results.append(result)
        logs.append(log)

    if False not in results:
        print(f"{iteration}: "+ GREEN +"OK" + RESET + ", Both Paths are the same")
        return True
    else:
        for i in range(len(results)):
            if not results[i]:
                stats[error_name[i]].append(iteration)
        print(f"{iteration}: "+ RED + "ERROR" + RESET + ", difference in the paths")
        for i in range(len(value_names)):
            print(f"{value_names[i]}s: {'OK' if results[i] else 'ERROR'}")
        print_path_payload(path_payload)
        for log in logs:
            print(log, end = '')

def geo_pretreatment(geos):
    i = 1
    while i < len(geos)-1:
        x1, y1 = geos[i-1][0], geos[i-1][1]
        x2, y2 = geos[i][0],   geos[i][1]
        x3, y3 = geos[i+1][0], geos[i+1][1]
        if compare_with_lease((y3 - y2)*(x2 - x1), (y2 - y1)*(x3 - x2)):#checks if the dots are colinear
            geos.pop(i)
        i+=1

def compare_lengths(routes_path, blocks_path, stats, iteration):
    logs = ""
    if compare_with_lease(routes_path["length"], blocks_path["length"]):
        return True, ""
    else:
        stats['routes_shorter' if routes_path["length"] < blocks_path["length"] else 'blocks_shorter'].append(iteration)
        logs = ("--------------  Length Comparison Informations  -------------------\n"
                f"routes length: {round(routes_path['length'],3)}\n"
                f"blocks length: {blocks_path['length']}\n")
        return False, logs

def compare_values(value_name, routes_values, blocks_values, comparison_function, print_function, stats, iteration): 
    i = 0
    len_routes_values = len(routes_values)
    len_blocks_values = len(blocks_values)
    min_len = min(len_routes_values, len_blocks_values)
    while i < min_len and comparison_function(routes_values[i], blocks_values[i]):
        i+=1
    if i == len_blocks_values == len_routes_values:
        return True,""
    else:
        logs = f"-------------- {value_name} Comparison Informations  -------------------\n\n"
        for j in range(i):
            logs += f"{value_name} {j}: same values, {print_function(routes_values[j])}\n"
        logs += f"From {value_name} {i} they start to diverge\n"

        logs += "\nroutes:\n"
        if i == len_routes_values:
            logs += f"      routes path finished at {value_name} {i-1}\n"
        else:
            for j in range(i,len_routes_values):
                logs += f"  {value_name} {j}: {print_function(routes_values[j])}\n"

        logs += "\nblocks:\n"
        if i == len_blocks_values:
            logs += f"      blocks path finished at {value_name} {i-1}\n"
        else:
            for j in range(i,len_blocks_values):
                logs += f"  {value_name} {j}: {print_function(blocks_values[j])}\n"     
        logs += '\n'
    return False, logs

def compare_slope(routes_slope, blocks_slope):
    return routes_slope['gradient'] == blocks_slope['gradient'] and compare_with_lease(routes_slope['position'], blocks_slope['position'])

def print_slope(slope):
    return f"gradient {slope['gradient']} at position {round(slope['position'],3)}"

def compare_curve(routes_curve, blocks_curve):
    return routes_curve['radius'] == blocks_curve['radius'] and compare_with_lease(routes_curve['position'], blocks_curve['position'])

def print_curve(curve):
    return f"radius {curve['radius']} at position {round(curve['position'],3)}"

def compare_geo(routes_geo, blocks_geo):
    return compare_with_lease(routes_geo[0], blocks_geo[0]) and compare_with_lease(routes_geo[1], blocks_geo[1])

def print_geo(geo):
    return f"({round(geo[0],3)},{round(geo[1],3)})"

def compare_step(routes_step, blocks_step):
    #only comparing the geos in steps
    routes_coordinates = routes_step['geo']['coordinates']
    blocks_coordinates = blocks_step['geo']['coordinates']
    return compare_with_lease(routes_coordinates[0], blocks_coordinates[0]) and compare_with_lease(routes_coordinates[1], blocks_coordinates[1])

def print_step(step):
    x = round(step['geo']['coordinates'][0], 3)
    y = round(step['geo']['coordinates'][1], 3)
    return f"({x},{y})"

def print_path_payload(payload):
    print("--------------  Given Payload  -------------------")
    print(f"infra: {payload['infra']}")
    print(f"name: {payload['name']}")
    steps = payload['steps']
    for i in range(len(steps)):
        print(f"step {i}: offset {round(steps[i]['waypoints'][0]['offset'], 3)} on track {steps[i]['waypoints'][0]['track_section']}")
    print('')

def compare_with_lease(a,b):
    return a - 0.002 <= b and a + 0.002 >= b

#Allows to replay a specific log
def compare_specific_log(log, iteration):
    current_directory = os.path.dirname(os.path.abspath(__file__))
    path_to_logs = os.path.join(current_directory, 'logs')
    f = open(f"{path_to_logs}/{log}/{iteration}", 'r')
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
        #stats and iteration are necessary because of a conception mistake that I made and a lack of time sorry :'(
        path_payload_routes = payload.copy()
        path_payload_routes["routes_or_blocks"] = "routes"
        path_payload_blocks = payload.copy()
        path_payload_blocks["routes_or_blocks"] = "blocks"

        routes_result: Response = post_with_timeout(URL + "pathfinding/", json=path_payload_routes)
        blocks_result: Response = post_with_timeout(URL + "pathfinding/", json=path_payload_blocks)
        if routes_result.status_code != blocks_result.status_code:
            print(RED +"ERROR" + RESET + f", Different status code, routes: {routes_result.status_code} blocks: {blocks_result.status_code}")
            print_path_payload(path_payload_routes)
        elif routes_result.status_code // 100 != 2:
            print(GREEN +"OK" + RESET + f", Both have status code: {routes_result.status_code}")
        else: 
            routes_path = json.loads(routes_result.content.decode())
            blocks_path = json.loads(blocks_result.content.decode())
            compare_paths(routes_path, blocks_path, path_payload_routes, stats, iteration)


#compare_specific_log(9, 53)
compare_pathfindings(50)