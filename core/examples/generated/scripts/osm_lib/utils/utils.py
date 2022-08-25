import time
import pickle
from enum import Enum
from pathlib import Path
from typing import Any, TypeVar
import sys
import logging

LOGGER = logging.getLogger()
LOGGER.setLevel(10)

try:
    from railjson_generator import get_output_dir  # type: ignore
except ImportError:
    LOGGER.warning("Failed to import get_output_dir")


R = TypeVar("R")

# Setting global path to objects
if len(sys.argv) > 1:
    OUTPUT_DIR = get_output_dir()
else:
    OUTPUT_DIR = Path(__file__).parents[3] / Path("output") / Path("osm_infra")
    LOGGER.warning("No output directory passed as argument")

PATH_TO_OSM_OBJECTS = Path(__file__).parents[2] / Path("osm_objects")
LOGGER.info(f"Saving objects at {PATH_TO_OSM_OBJECTS}")


def debug_decorator(logger: logging.Logger = LOGGER):
    """Decorator used to display what functions are executed, as well as the execution time"""

    def decorator(f):
        def wrapper(*args, **kwargs) -> R:
            start_time = time.time()
            logger.info(f"Entering function {f.__name__}")
            result = f(*args, **kwargs)
            end_time = time.time()
            logger.info(f"Exiting function {f.__name__}")
            if "id" in kwargs.keys():
                id = kwargs.get("id", "")
                id_param = f"with id parameter {id}"
            else:
                id_param = ""
            delta = end_time - start_time
            if delta >= 0.01:
                time_string = f"{int(delta//3600)}:{int((delta%3600)//60)}:{int(delta%60)}"
                logger.debug(
                    f"""Time taken to execute function {f.__name__}{id_param} : \
                        {time_string} and {round(delta%1, 3) * 1000}ms"""
                )

            return result

        return wrapper

    return decorator


def load_object(path: Path) -> object:
    """Loads the object saved at the given location and returns it"""
    with path.open(mode="rb") as obj_file:
        obj = pickle.load(obj_file)
    return obj


def save_object(obj: object, path: Path) -> None:
    """Saves the object given as a parameter to the given location"""
    with path.open(mode="wb") as obj_file:
        pickle.dump(obj, obj_file)


def clear_duplicates(L: list[Any]) -> None:
    """Clears the entry list from any duplicates"""
    i = 0
    while i < len(L):
        if L.count(L[i]) >= 2:
            L.pop(i)
        else:
            i += 1


class RelationTypes(str, Enum):
    NETWORK = "network"
    ROUTE_MASTER = "route_master"
    ROUTE = "route"
    OTHER = "other"
