from typing import Optional, List
from pydantic import BaseSettings
from functools import lru_cache
from chartos.utils import ValueDependable


class Settings(BaseSettings):
    config_path: str
    allowed_origins: List[str] = ["*"]

    max_zoom: int = 18

    # those are needed to build mvt layer metadata
    root_url: str

    # postgres://user:password@host:port/database?option=value
    psql_dsn: str
    psql_user: Optional[str] = None
    psql_password: Optional[str] = None
    redis_url: str

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
