import json
import yaml
import asyncpg
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from .settings import Settings, get_settings, get_env_settings
from .config import Config, get_config
from .psql import PSQLPool
from .dbinit import DBInit
from .redis import RedisPool
from .views import router as view_router


def read_config(settings: Settings) -> Config:
    with open(settings.config_path) as f:
        config_data = yaml.safe_load(f)
        return Config.parse(config_data)


def make_app(settings: Optional[Settings] = None) -> FastAPI:
    if settings is None:
        settings = get_env_settings()
    # create the application
    app = FastAPI()
    app.include_router(view_router)

    # setup CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # parse the configuration and setup dep injection
    config = read_config(settings)
    get_config.setup(app, config)
    get_settings.setup(app, settings)

    # setup the redis pool process
    RedisPool.setup(app, settings.redis_url)

    # setup the postgresql pool process
    psql_pool = PSQLPool.setup(app, settings.psql_settings())

    # initialize the database initialization process
    DBInit.setup(app, config, psql_pool)
    return app
