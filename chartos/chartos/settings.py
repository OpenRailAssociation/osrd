from functools import lru_cache
from typing import List, Optional

from pydantic import BaseSettings

from chartos.utils import ValueDependable


class Settings(BaseSettings):
    config_path: str = "chartos.yml"
    allowed_origins: List[str] = ["*"]

    max_zoom: int = 18

    # those are needed to build mvt layer metadata
    root_url: str = "http://localhost:7000"

    # postgres://user:password@host:port/database?option=value
    psql_dsn: str = "postgres://osrd:password@localhost:5432/osrd"
    psql_user: Optional[str] = None
    psql_password: Optional[str] = None
    redis_url: str = "redis://localhost:6379"
    max_tiles: int = 250_000

    def psql_settings(self):
        return {
            "dsn": self.psql_dsn,
            "user": self.psql_user,
            "password": self.psql_password,
        }


get_settings = ValueDependable("get_settings")


@lru_cache()
def get_env_settings():
    return Settings()
