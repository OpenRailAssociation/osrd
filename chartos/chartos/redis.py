from aioredis import Redis, ConnectionPool
from fastapi import FastAPI
from .utils import AsyncProcess, process_dependable


class RedisPool(AsyncProcess):
    def __init__(self, url, max_conns=10):
        self.pool = ConnectionPool.from_url(url, max_connections=max_conns)

    async def on_startup(self):
        # the pool is lasily created on the first request,
        # nothing need to be done here
        pass

    async def on_shutdown(self):
        await self.pool.disconnect()

    def acquire(self):
        return Redis(
            connection_pool=self.pool,
            single_connection_client=True
        )

    @process_dependable
    async def get(self) -> Redis:
        async with self.acquire() as conn:
            yield conn
