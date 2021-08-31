from os import getenv, environ

# when developping, enable debug mode and skip authentication
environ.setdefault("OSRD_DEV_SETUP", "1")
environ.setdefault("OSRD_DEBUG", "1")
environ.setdefault("OSRD_SKIP_AUTH", "1")

from config.settings import *  # noqa

DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'osrd',
        'USER': 'osrd',
        'PASSWORD': 'nopasswd',
        'HOST': 'localhost',
    },
    'gaia': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'gaia',
        'USER': 'osrd',
        'PASSWORD': 'nopasswd',
        'HOST': 'localhost',
    }
}

ROOT_PATH = ''

STATIC_URL = ROOT_PATH + '/static/'

ROOT_URLCONF = 'config.workspace_urls'

INSTALLED_APPS.append("corsheaders")
MIDDLEWARE.append('corsheaders.middleware.CorsMiddleware')
CORS_ORIGIN_ALLOW_ALL = True
