import asyncio
import ssl
from pathlib import Path
from typing import List, Dict, Any

import aiohttp
import boto3
from aiohttp import ClientSession
import subprocess
import webbrowser


def make_connector(gateway_cookie):
    if gateway_cookie is not None:
        cookies = {"gateway": gateway_cookie}
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        connector = aiohttp.TCPConnector(ssl=ssl_context)
    else:
        cookies = None
        connector = None
    return cookies, connector


async def get_paginated(
    url: str, session: ClientSession, n_workers: int = 5
) -> List[Dict]:
    initial_url = url.replace("$page", "1")
    print("downloading first page")
    initial_response = await get_with_retries(session, initial_url)
    page_count = initial_response["page_count"]
    print(f"first page done, {page_count} total pages")

    semaphore = asyncio.Semaphore(n_workers)

    async def fetch_page(page):
        async with semaphore:
            url_page = url.replace("$page", str(page))
            print(f"downloading page {page}/{page_count}")
            json_response = await get_with_retries(session, url_page)
            return json_response["results"]

    all_pages = list(range(2, page_count + 1))
    tasks = [fetch_page(page) for page in all_pages]
    page_contents = await asyncio.gather(*tasks)

    res = initial_response["results"]
    for page_content in page_contents:
        res += page_content
    return res


async def get_with_retries(
    session: aiohttp.ClientSession, url: str, n_retries: int = 5
) -> dict:
    retry = 0
    while True:
        try:
            async with session.get(url) as response:
                return await response.json()
        except aiohttp.ClientResponseError as e:
            if e.status // 100 == 5 and retry < n_retries:
                retry += 1
                print(f"http error, trying again in a few seconds: {e}")
                await asyncio.sleep(10.0)
            else:
                raise e


def download_s3_file(s3_client, bucket: str, path: str, s3_cache: Path) -> Path:
    """
    Download a file from s3, only if not already cached. Returns a `Path` to the downloaded file.
    """
    local_path = s3_cache / bucket / path
    if local_path.exists():
        print(f"local cache hit for {bucket}/{path}, at {local_path}")
        return local_path
    print(f"downloading {bucket}/{path} from s3...")

    local_path.parent.mkdir(parents=True, exist_ok=True)
    s3_client.download_file(bucket, path, str(local_path))
    return local_path


def open_html(html: Path):
    """
    Opens an HTML file in the default web browser. In WSL environments, opens the default host browser.
    """

    def is_wsl():
        try:
            with open("/proc/version", "r") as f:
                return "microsoft" in f.read().lower()
        except FileNotFoundError:
            return False

    if is_wsl():
        win_path = (
            subprocess.check_output(["wslpath", "-w", str(html)]).decode().strip()
        )
        subprocess.run(["cmd.exe", "/C", "start", "", win_path])
    else:
        webbrowser.open(str(html))


def create_aws_session(profile: str) -> Any:
    """
    Create a working aws session. Refresh SSO login if necessary.
    On error, include relevant documentation in exception message.
    """
    try:
        session = boto3.Session(profile_name=profile)
        # Basic call just to make sure the sso is setup
        session.client("s3").list_buckets()
    except:
        print("Can't access s3 bucket, refreshing SSO login...")
        try:
            subprocess.check_call(f"aws sso login --profile {profile}".split())
            session = boto3.Session(profile_name=profile)
        except Exception as e:
            err = (
                "\n\n"
                + "Couldn't create a working s3 sessions.\n"
                + "If the SSO login doesn't work, refer to the setup documented here:\n"
                + "https://gitlab-repo-res.apps.eul.sncf.fr/dsir/groupedxs-dsir/04735/osrd\n"
                + "Original error: "
                + str(e)
            )
            raise RuntimeError(err)
    return session
