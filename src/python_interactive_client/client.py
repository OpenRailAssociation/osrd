#!/usr/bin/env python3

import asyncio
import websockets
import json
from pathlib import Path
from enum import IntEnum

class EventType(IntEnum):
    TRAIN_CREATED = 0
    TRAIN_MOVE_EVENT = 1
    TRAIN_REACHES_ACTION_POINT = 2
    TRAIN_RESTARTS = 3
    SWITCH_MOVE = 3

    def serialize(self):
        return self.name

    @staticmethod
    def all():
        return list(EventType)

class ChangeType(IntEnum):
    ROUTE_STATUS_CHANGE = 0

    def serialize(self):
        return self.name

    @staticmethod
    def all():
        return list(ChangeType)


def load_json(path):
    with path.open() as f:
        return json.load(f)


class SimulationError(Exception):
    pass


def check_response_type(response, allowed_types):
    if response["message_type"] in allowed_types:
        return
    raise SimulationError(response)


class InteractiveSimulationManager:
    __slots__ = ("ws_uri", "ws_manager")

    def __init__(self, ws_uri):
        self.ws_uri = ws_uri
        self.ws_manager = None

    async def __aenter__(self):
        self.ws_manager = websockets.connect(self.ws_uri)
        ws = await self.ws_manager.__aenter__()
        return InteractiveSimulation(ws)

    async def __aexit__(self, exc_type, exc, tb):
        await self.ws_manager.__aexit__(exc_type, exc, tb)


class InteractiveSimulation:
    __slots__ = ("websocket",)

    def __init__(self, websocket):
        self.websocket = websocket

    def send_json(self, message):
        return self.websocket.send(json.dumps(message))

    @staticmethod
    def open_websocket(ws_uri):
        return InteractiveSimulationManager(ws_uri)

    async def init(self, infra_path, rolling_stocks_path=None):
        infra = load_json(Path(infra_path))
        if rolling_stocks_path is None:
            rolling_stocks = []
        else:
            rolling_stocks = [
                load_json(rolling_stock_file)
                for rolling_stock_file in Path(rolling_stocks_path).glob("*.json")
            ]

        await self.send_json({
            "message_type": "init",
            "infra": infra,
            "extra_rolling_stocks": rolling_stocks,
        })
        response = json.loads(await self.websocket.recv())
        check_response_type(response, {"session_initialized"})
        return response

    async def create_simulation(self, simulation_path, successions_path=None, virtual_points=[]):
        sim = load_json(Path(simulation_path))
        successions = None
        if successions_path is not None:
            successions = load_json(successions_path)

        await self.send_json({
            "message_type": "create_simulation",
            "train_schedules": sim["train_schedules"],
            "rolling_stocks": sim["rolling_stocks"],
            "successions": successions,
            "virtual_points": virtual_points,
        })
        response = json.loads(await self.websocket.recv())
        check_response_type(response, {"simulation_created"})
        return response

    async def watch_changes(self, change_types):
        await self.send_json({
            "message_type": "watch_changes",
            "change_types": [change_type.serialize() for change_type in change_types],
        })
        response = json.loads(await self.websocket.recv())
        check_response_type(response, {"watch_changes"})
        return response


    async def run(self, until_events=[]):
        await self.send_json({
            "message_type": "run",
            "until_events": [event.serialize() for event in until_events],
        })
        response = json.loads(await self.websocket.recv())
        check_response_type(response, {
            "simulation_complete",
            "simulation_paused",
            "change_occurred"
        })
        return response



async def test(infra_path: Path, simulation_path: Path, rolling_stocks_path: Path):
    async with InteractiveSimulation.open_websocket("ws://localhost:9000/websockets/simulate") as simulation:
        print(await simulation.init(infra_path, rolling_stocks_path))
        virtual_points = [{
            "name": "virtual_point_test",
            "location": {
                "track_section": "ne.micro.foo_b",
                "offset": 150
                }
            }]
        print(await simulation.create_simulation(simulation_path, virtual_points=virtual_points))
        print(await simulation.watch_changes(ChangeType.all()))

        while True:
            stop_message = await simulation.run(until_events=EventType.all())
            print(stop_message)
            if stop_message["message_type"] == "simulation_complete":
                break


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent.parent
    examples = base_dir / "examples"
    infra_path = examples / "tiny_infra/infra.json"
    rolling_stocks_path = examples / "rolling_stocks"
    simulation_path = examples / "tiny_infra/simulation.json"
    asyncio.run(test(infra_path, simulation_path, rolling_stocks_path))
