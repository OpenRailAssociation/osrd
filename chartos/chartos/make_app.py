import json
import yaml
import asyncpg
import shapely.wkb
import pyproj
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from shapely.ops import transform
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


pseudo_mercator = pyproj.CRS('EPSG:3857')
gps = pyproj.CRS('EPSG:4326')

pseudo_mercator_to_gps = pyproj.Transformer.from_crs(
    pseudo_mercator, gps, always_xy=True).transform

gps_to_pseudo_mercator = pyproj.Transformer.from_crs(
    gps, pseudo_mercator, always_xy=True).transform


def encode_geometry(geometry):
    geom = shapely.geometry.shape(geometry)
    geom = transform(gps_to_pseudo_mercator, geom)
    return shapely.wkb.dumps(geom)


def decode_geometry(data):
    geom = shapely.wkb.loads(data)
    return transform(pseudo_mercator_to_gps, geom)


async def init_psql_conn(conn: asyncpg.Connection):
    await conn.set_type_codec(
        'geometry',  # also works for 'geography'
        encoder=encode_geometry,
        decoder=decode_geometry,
        format='binary',
    )
    await conn.set_type_codec(
        'jsonb',
        encoder=json.dumps,
        decoder=json.loads,
        schema='pg_catalog'
    )


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
    psql_settings = {
        **settings.psql_settings(),
        "init": init_psql_conn,
    }
    psql_pool = PSQLPool.setup(app, psql_settings)

    # initialize the database initialization process
    DBInit.setup(app, config, psql_pool)
    return app
