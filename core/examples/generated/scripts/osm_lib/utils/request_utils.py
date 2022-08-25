import requests
from typing import Any

from .utils import debug_decorator

session = requests.Session()
OVERPASS_CONNEXION_TRIES = 25


@debug_decorator()
def query_overpass_api(overpass_query: str) -> dict[str, Any]:
    """Queries the overpass api with the request given as parameter.
    Returns a dict corresponding to the returned json file.
    If the api doesn't respond, raises an exception"""
    overpass_url = "http://overpass-api.de/api/interpreter"
    # overpass_url = "http://overpass.openstreetmap.fr/api/"
    for _ in range(OVERPASS_CONNEXION_TRIES):
        response = session.get(overpass_url, params={"data": overpass_query})
        if response.status_code // 200 == 1:
            return response.json()
    raise Exception("Overpass query failed")
