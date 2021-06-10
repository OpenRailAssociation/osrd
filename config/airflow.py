from os import getenv  # noqa: F401

from config.settings import *  # noqa: F403
from airflow.hooks.base_hook import BaseHook

db_link = BaseHook.get_connection('osrd_db_link')
cache_link = BaseHook.get_connection('osrd_cache_link')
back_link = BaseHook.get_connection('osrd_back')
chartis_link = BaseHook.get_connection('osrd_to_chartis')

DEBUG = False

REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] = ['rest_framework.renderers.JSONRenderer']  # noqa: F405

DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'HOST': db_link.host,
        'NAME': db_link.schema,
        'USER': db_link.login,
        'PASSWORD': db_link.password,
        # 'CONN_MAX_AGE': None,
    },
}

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': f'rediss://:{cache_link.password}@{cache_link.host}:{cache_link.port}/{cache_link.schema}',
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        }
    }
}

OSRD_BACKEND_URL = back_link.host
OSRD_BACKEND_TOKEN = back_link.password

CHARTIS_URL = chartis_link.host
CHARTIS_TOKEN = chartis_link.password
