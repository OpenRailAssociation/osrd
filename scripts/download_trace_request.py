#
# This script can be used to download all data logged for a given stdcm request.
#

import io
import requests
import json
import zipfile
from typing import Dict

EDITOAST_URL = "https://rec-osrd.reseau.sncf.fr/"
COOKIES = {
    # Connect to the front-end and look through the "cookies" part of any sent request
    "gateway" : ""
}
TRACE_ID = ""
OUT_REQUEST = "stdcm-request.json"
OUT_REQUEST_ZIP = "stdcm-request.zip"
OUT_METADATA = "stdcm-log-metadata.json"

# If set to true, the request will be written directly into a zip archive
ZIP_REQUEST = False


def download_trace(trace_id: str) -> Dict:
    url = f"{EDITOAST_URL}api/stdcm_log?trace_id={trace_id}"
    response = requests.get(url, cookies=COOKIES, verify=False)
    response.raise_for_status()
    json_response = response.json()
    return json_response

def write_request(data: Dict):
    if ZIP_REQUEST:
        with zipfile.ZipFile(OUT_REQUEST_ZIP, "w", zipfile.ZIP_DEFLATED) as zipf:
            json_buffer = io.BytesIO()
            json_data = json.dumps(data, ensure_ascii=False, indent=4)
            json_buffer.write(json_data.encode("utf-8"))
            zipf.writestr(OUT_REQUEST, json_buffer.getvalue())
            print(f"dumped request for trace {TRACE_ID} to {OUT_REQUEST_ZIP}")
    else:
        with open(OUT_REQUEST, "w", encoding="utf-8") as jsonfile:
            json.dump(trace_log["request"], jsonfile, ensure_ascii=False, indent=4)
        print(f"dumped request for trace {TRACE_ID} to {OUT_REQUEST}")


if __name__ == "__main__":
    trace_log = download_trace(TRACE_ID)

    if OUT_REQUEST:
        write_request(trace_log["request"])
        del trace_log["request"]

    if OUT_METADATA:
        with open(OUT_METADATA, "w", encoding="utf-8") as jsonfile:
            json.dump(trace_log, jsonfile, ensure_ascii=False, indent=4)
        print(f"dumped all data for trace {TRACE_ID} to {OUT_METADATA}")
