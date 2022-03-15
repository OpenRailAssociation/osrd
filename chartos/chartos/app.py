from .make_app import make_app
from .settings import get_env_settings


app = make_app(get_env_settings())
