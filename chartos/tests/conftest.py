import httpx
import pytest
import asyncpg

from chartos import make_app, get_env_settings
from chartos.psql import PSQLPool
from chartos.redis import RedisPool
from asgi_lifespan import LifespanManager


@pytest.fixture
def settings():
    return get_env_settings()


"""
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
COMMENT ON SCHEMA public IS 'standard public schema';
"""


async def flush_database(conn):
    query = "select tablename from pg_tables where schemaname = 'public';"
    for (tablename,) in await conn.fetch(query):
        try:
            await conn.execute(f"drop table if exists \"{tablename}\" cascade;")
        except asyncpg.exceptions.InsufficientPrivilegeError:
            pass


@pytest.fixture
async def app(settings):
    app = make_app(settings)

    # start the app once to wipe the database
    async with LifespanManager(app):
        psql_pool = PSQLPool.get_process(app)
        redis_pool = RedisPool.get_process(app)

        # wipe the postgresql database
        async with psql_pool.acquire() as conn:
            await flush_database(conn)

        # wipe the redis
        async with redis_pool.acquire() as conn:
            await conn.flushdb()

    # restart it for good this time
    async with LifespanManager(app):
        yield app


@pytest.fixture
async def client(app, settings):
    async with httpx.AsyncClient(app=app, base_url=settings.root_url) as client:
        yield client
