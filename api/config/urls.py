"""osrd URL Configuration
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings

from osrd_infra.views import health


root_path = ""
if settings.ROOT_PATH:
    root_path = f"{settings.ROOT_PATH}/"


service_urlpatterns = [
    # this app exports multiple features at once,
    # hence the lack of prefix
    path("", include("osrd_infra.urls")),
]


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", health),
    path(root_path, include(service_urlpatterns)),
]
