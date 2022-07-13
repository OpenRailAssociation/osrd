import asyncpg
from fastapi import FastAPI
from .config import Layer
from .utils import AsyncProcess, process_dependable


tilebbox_func = """
    create or replace function TileBBox (z int, x int, y int, srid int = 3857)
        returns geometry
        language plpgsql immutable as
    $func$
    declare
        max numeric := 20037508.34;
        res numeric := (max*2)/(2^z);
        bbox geometry;
    begin
        bbox := ST_MakeEnvelope(
            -max + (x * res),
            max - (y * res),
            -max + (x * res) + res,
            max - (y * res) - res,
            3857
        );
        if srid = 3857 then
            return bbox;
        else
            return ST_Transform(bbox, srid);
        end if;
    end;
    $func$
"""


class DBInit(AsyncProcess):
    def __init__(self, config, psql_pool):
        self.config = config
        self.psql_pool = psql_pool

    async def on_startup(self):
        async with self.psql_pool.acquire() as conn:
            try:
                # add the TileBBox utility
                await conn.execute(tilebbox_func)
            finally:
                await conn.reload_schema_state()

    async def on_shutdown(self):
        pass
