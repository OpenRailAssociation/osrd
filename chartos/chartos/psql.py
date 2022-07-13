import asyncpg
from fastapi import FastAPI
from .utils import AsyncProcess, process_dependable


class PSQLPool(AsyncProcess):
    def __init__(self, settings):
        self.pool = None
        self.settings = settings

    async def on_startup(self):
        self.pool = await asyncpg.create_pool(**self.settings)

    async def on_shutdown(self):
        await self.pool.close()

    def acquire(self):
        return self.pool.acquire()

    @process_dependable
    async def get(self) -> asyncpg.Connection:
        async with self.acquire() as con:
            yield con
