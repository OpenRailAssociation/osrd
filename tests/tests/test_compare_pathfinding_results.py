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
BLUE = "\033[34m"

N_ITERATIONS = 300

def compare_pathfindings(iterations: int):
    infraGraph = make_graph(URL, INFRA_ID)
    requests.post(EDITOAST_URL + f"infra/{INFRA_ID}/load").raise_for_status()
    #initialize it to give stats in the end 
    stats = {
        'ok': [],
        'error': [],
        'status_code_problem': [],
        'same_length_diff_steps': [],
        'routes_shorter': [],
        'blocks_shorter': [],
    }
    
    for i in range(0,iterations):
        compare_pathfinding(infraGraph, stats, i)

def compare_pathfinding(infraGraph, stats, iteration):
        path,_ = make_valid_path(infraGraph)
        path_payload_routes = make_payload_path(INFRA_ID, path)
        path_payload_routes["routes_or_blocks"] = "routes"
        path_payload_blocks = path_payload_routes.copy()
        path_payload_blocks["routes_or_blocks"] = "blocks"

        routes_result: Response = post_with_timeout(URL + "pathfinding/", json=path_payload_routes)
        blocks_result: Response = post_with_timeout(URL + "pathfinding/", json=path_payload_blocks)
        if routes_result.status_code != blocks_result.status_code:
            stats['status_code_problem'].append(iteration)
            stats['error'].append(iteration)
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
            else:
                stats['error'].append(iteration)



def compare_paths(routes_path, blocks_path, path_payload, stats, iteration):

    value_names = [
                'Length',
                'Slope',
                'Curve',
                #'Geo',
                'Step'
    ]
    
    value_getters = [
        None,
        lambda x: x['slopes'],
        lambda x: x['curves'],
        #lambda x: x['geographic']['coordinates'],
        lambda x: x['steps']
    ]
           
    comparison_functions = [
        None,
        compare_slope,
        compare_curve,
        #compare_geo,
        compare_step
    ]

    print_functions = [
        None,
        print_slope,
        print_curve,
        #print_geo,
        print_step
    ]

    results = [] #The bools we get from the compairsons
    logs = [] #What we want to be printed if there is a problem

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
        print(f"{iteration}: "+ RED + "ERROR" + RESET + ", difference in the paths")
        for i in range(len(value_names)):
            print(f"{value_names[i]}s: {'OK' if results[i] else 'ERROR'}")
        print_path_payload(path_payload)
        for log in logs:
            print(log, end = '')

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
    return round(routes_geo[0],5) == round(blocks_geo[0],5) and round(routes_geo[1],5) == round(blocks_geo[1],5)

def print_geo(geo):
    return f"({round(geo[0],5)},{round(geo[1],5)})"

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
    return round(a,3) == round(b,3)

compare_pathfindings(N_ITERATIONS)