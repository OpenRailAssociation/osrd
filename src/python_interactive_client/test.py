from osrd_interactive import (
    Breakpoint,
    ChangeType,
    EventType,
    InteractiveSimulation,
    Location,
    SimulationState,
    TST,
)

from pathlib import Path
import asyncio
import logging


logger = logging.getLogger("test")


async def test(infra_path: Path, simulation_path: Path, rolling_stocks_path: Path):
    async with InteractiveSimulation.open_websocket(
        "ws://localhost:9000/websockets/simulate"
    ) as simulation:
        await simulation.init(infra_path, rolling_stocks_path)
        breakpoints = [Breakpoint("my-breakpoint", Location("ne.micro.foo_b", 175))]
        await simulation.create_simulation(simulation_path, breakpoints=breakpoints)
        await simulation.watch_changes(ChangeType.all())
        await simulation.update_tst([TST("il.switch_foo", ["Test."])])

        while not simulation.is_complete:
            async for _ in simulation.run(until_events=EventType.all()):
                pass
            logger.info("event: %s", simulation.current_event)

            # if the simulation
            if simulation.is_paused:
                delays = await simulation.get_train_delays()
                logger.info("delays: %s", delays)
        tst = await simulation.get_tst("il.switch_foo")
        logger.info("TST: %s", tst)

if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    logging.getLogger("websockets").setLevel(logging.ERROR)
    base_dir = Path(__file__).resolve().parent.parent.parent
    examples = base_dir / "examples"
    infra_path = examples / "tiny_infra/infra.json"
    rolling_stocks_path = examples / "rolling_stocks"
    simulation_path = examples / "tiny_infra/simulation.json"
    asyncio.run(test(infra_path, simulation_path, rolling_stocks_path))
