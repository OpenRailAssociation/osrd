from os import environ, getenv

# when developping, enable debug mode and skip authentication
environ.setdefault("OSRD_DEV_SETUP", "1")
environ.setdefault("OSRD_DEBUG", "1")
environ.setdefault("OSRD_SKIP_AUTH", "1")


from config.settings import *  # noqa

PSQL_DATABASE = getenv("PSQL_DATABASE", "osrd")
PSQL_USERNAME = getenv("PSQL_USERNAME", "osrd")
PSQL_PASSWORD = getenv("PSQL_PASSWORD", "password")
PSQL_HOST = getenv("PSQL_HOST", "localhost")


DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": PSQL_DATABASE,
        "USER": PSQL_USERNAME,
        "PASSWORD": PSQL_PASSWORD,
        "HOST": PSQL_HOST,
    },
}

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "unique-snowflake",
    }
}

ROOT_PATH = ""

STATIC_URL = ROOT_PATH + "/static/"

INSTALLED_APPS.append("corsheaders")
MIDDLEWARE.append("corsheaders.middleware.CorsMiddleware")
CORS_ORIGIN_ALLOW_ALL = True

CHARTIS_URL = getenv("CHARTIS_URL", "http://localhost:7000")
CHARTIS_TOKEN = getenv("CHARTIS_TOKEN", "")
