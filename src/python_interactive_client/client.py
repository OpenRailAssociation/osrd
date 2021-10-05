#!/usr/bin/env python3

import asyncio
import websockets
import json
from pathlib import Path


def load_json(path):
    with path.open() as f:
        return json.load(f)


class InteractiveSimulation:
    __slots__ = ("websocket",)

    def __init__(self, websocket):
        self.websocket = websocket

    async def init(self, infra_path, rolling_stocks_path = None):
        infra = load_json(Path(infra_path))
        if rolling_stocks_path is None:
            rolling_stocks = []
        else:
            rolling_stocks = [
                load_json(rolling_stock_file)
                for rolling_stock_file
                in Path(rolling_stocks_path).glob("*.json")
            ]

        message = {
            "message_type": "init",
            "infra": infra,
            "extra_rolling_stocks": rolling_stocks
        }
        print("sending message")
        await self.websocket.send(json.dumps(message))
        print("message sent, waiting for a response")
        print(await self.websocket.recv())
        print("got a response")


async def main():
    async with websockets.connect("ws://localhost:9000/websockets/simulate") as websocket:
        simulation = InteractiveSimulation(websocket)
        await simulation.init("examples/tiny_infra/infra.json")


asyncio.run(main())
