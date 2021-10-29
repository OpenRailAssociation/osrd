#!/usr/bin/env python3

from dataclasses import dataclass, asdict
from enum import IntEnum
from pathlib import Path
from typing import List
import asyncio
import json
import logging
import websockets


logger = logging.getLogger(__name__)


class EventType(IntEnum):
    TRAIN_CREATED = 0
    TRAIN_MOVE = 1
    TRAIN_REACHES_ACTION_POINT = 2
    TRAIN_RESTARTS = 3
    SWITCH_MOVE = 4
    TRAIN_REACHES_BREAKPOINT = 5

    def serialize(self):
        return self.name

    @staticmethod
    def all():
        return list(EventType)


class ChangeType(IntEnum):
    ROUTE_STATUS = 0

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


@dataclass
class Location:
    track_section: str
    offset: float


@dataclass
class Breakpoint:
    name: str
    location: Location

@dataclass
class TST:
    switch: str
    train_order: List[str]


def check_response_type(response, allowed_types) -> str:
    message_type = response["message_type"]
    if message_type in allowed_types:
        return message_type
    raise SimulationError(f"Expected message type {allowed_types} got: '{response['message_type']}'. More details: '{response}'")


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


class SimulationState(IntEnum):
    UNINITIALIZED = 0
    WAITING_FOR_SIMULATION = 1
    PAUSED = 2
    RUNNING = 3
    SIMULATION_COMPLETE = 4


STATE_CHANGE_MESSAGES = {
    "session_initialized": SimulationState.WAITING_FOR_SIMULATION,
    "simulation_created": SimulationState.PAUSED,
    "simulation_complete": SimulationState.SIMULATION_COMPLETE,
    "simulation_paused": SimulationState.PAUSED,
}


class InteractiveSimulation:
    __slots__ = ("websocket", "state", "current_event", "result")

    def __init__(self, websocket):
        self.websocket = websocket
        self.state = SimulationState.UNINITIALIZED
        self.current_event = None
        self.result = None

    @property
    def is_complete(self):
        return self.state is SimulationState.SIMULATION_COMPLETE

    @property
    def is_paused(self):
        return self.state is SimulationState.PAUSED

    async def recv_json(self):
        message = json.loads(await self.websocket.recv())
        message_type = message["message_type"]
        logger.debug("received %s", message_type)
        return message

    def send_json(self, message):
        response = self.websocket.send(json.dumps(message))
        message_type = message["message_type"]
        logger.debug("sent %s", message_type)
        return response

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

        await self.send_json(
            {
                "message_type": "init",
                "infra": infra,
                "extra_rolling_stocks": rolling_stocks,
            }
        )
        response = await self.recv_json()
        check_response_type(response, {"session_initialized"})
        self.state = SimulationState.WAITING_FOR_SIMULATION
        return response

    async def create_simulation(
        self, simulation_path, successions_path=None, breakpoints=[]
    ):
        sim = load_json(Path(simulation_path))
        successions = None
        if successions_path is not None:
            successions = load_json(successions_path)

        await self.send_json(
            {
                "message_type": "create_simulation",
                "train_schedules": sim["train_schedules"],
                "rolling_stocks": sim["rolling_stocks"],
                "successions": successions,
                "breakpoints": [asdict(b) for b in breakpoints],
            }
        )
        response = await self.recv_json()
        check_response_type(response, {"simulation_created"})
        self.state = SimulationState.PAUSED
        return response

    async def watch_changes(self, change_types):
        await self.send_json(
            {
                "message_type": "watch_changes",
                "change_types": [
                    change_type.serialize() for change_type in change_types
                ],
            }
        )
        response = await self.recv_json()
        check_response_type(response, {"watch_changes"})
        return response

    async def get_train_delays(self, trains=None):
        await self.send_json(
            {
                "message_type": "get_train_delays",
                "trains": trains,
            }
        )
        response = await self.recv_json()
        check_response_type(response, {"train_delays"})
        return response

    async def run(self, until_events=()):
        await self.send_json(
            {
                "message_type": "run",
                "until_events": [event.serialize() for event in until_events],
            }
        )

        while True:
            self.state = SimulationState.RUNNING
            response = await self.recv_json()
            message_type = response["message_type"]
            new_state = STATE_CHANGE_MESSAGES.get(message_type)
            if new_state is not None:
                if new_state == SimulationState.SIMULATION_COMPLETE:
                    self.result = response["result"]
                self.state = new_state
                self.current_event = (
                    response["event"]
                    if message_type == "simulation_paused"
                    else None
                )
                break
            yield response

    async def get_tst(self, *switches):
        """
        Get train succession order. Can be call when simulation is paused or complete.
        If no switch id is given as argument then return all the tst.
        """
        await self.send_json(
            {
                "message_type": "get_train_succession_tables",
                "switches": switches
            }
        )
        response = await self.recv_json()
        check_response_type(response, {"train_succession_tables"})
        tst_list = []
        for switch, train_order in response["train_succession"].items():
            tst_list.append(TST(switch, train_order))
        return tst_list

    async def update_tst(self, new_tst_list: List[TST]):
        """
        Update train succession order. Can be call when simulation is paused.
        """
        await self.send_json(
            {
                "message_type": "update_train_succession_tables",
                "train_succession_tables": [asdict(tst) for tst in new_tst_list],
            }
        )
        response = await self.recv_json()
        check_response_type(response, {"train_succession_tables_updated"})
        return response
