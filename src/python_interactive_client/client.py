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
        await self.websocket.send(json.dumps(message))
        print(await self.websocket.recv())

    async def create_simulation(self, simulation_path, successions_path = None):
        sim = load_json(Path(simulation_path))
        if successions_path is None:
            successions = None
        else:
            successions = load_json(successions_path)

        message = {
            "message_type": "create_simulation",
            "train_schedules": sim["train_schedules"],
            "rolling_stocks": sim["rolling_stocks"],
            "successions": successions,
        }
        await self.websocket.send(json.dumps(message))
        print(await self.websocket.recv())

    async def run(self):
        message = {"message_type": "run"}
        await self.websocket.send(json.dumps(message))
        print(await self.websocket.recv())

async def main():
    async with websockets.connect("ws://localhost:9000/websockets/simulate") as websocket:
        simulation = InteractiveSimulation(websocket)
        await simulation.init("../../examples/tiny_infra/infra.json", "../../examples/rolling_stocks")
        await simulation.create_simulation("../../examples/tiny_infra/simulation.json")
        await simulation.run()


asyncio.run(main())
