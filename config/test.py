from os import getenv, system
from sys import stderr
from subprocess import check_output

from config.settings import *

DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': 'osrd',
        'USER': 'osrd',
        'PASSWORD': 'nopasswd',
        'HOST': 'localhost',
    }
}

ROOT_PATH = ''

STATIC_URL = ROOT_PATH + '/static/'

INSTALLED_APPS += [
    'debug_toolbar',
#    'debug_toolbar_line_profiler'
]

ROOT_URLCONF = 'config.workspace_urls'

MIDDLEWARE += ['debug_toolbar.middleware.DebugToolbarMiddleware']
MIDDLEWARE += ['config.test_middleware.LocalUserMiddleware']
# MIDDLEWARE += ['service_core.gateway_auth.GatewayUserMiddleware']

DEBUG = True

INTERNAL_IPS = ['127.0.0.1']

DEBUG_TOOLBAR_PANELS = [
    'debug_toolbar.panels.history.HistoryPanel',
    'debug_toolbar.panels.versions.VersionsPanel',
    'debug_toolbar.panels.timer.TimerPanel',
    'debug_toolbar.panels.settings.SettingsPanel',
    'debug_toolbar.panels.headers.HeadersPanel',
    'debug_toolbar.panels.request.RequestPanel',
    'debug_toolbar.panels.sql.SQLPanel',
    'debug_toolbar.panels.staticfiles.StaticFilesPanel',
    'debug_toolbar.panels.templates.TemplatesPanel',
    'debug_toolbar.panels.cache.CachePanel',
    'debug_toolbar.panels.signals.SignalsPanel',
    'debug_toolbar.panels.logging.LoggingPanel',
    'debug_toolbar.panels.redirects.RedirectsPanel',
    'debug_toolbar.panels.profiling.ProfilingPanel',

#    'debug_toolbar_line_profiler.panel.ProfilingPanel',
]
