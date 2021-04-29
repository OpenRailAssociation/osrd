"""osrd URL Configuration
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings

from service_core.internal_views import HealthView


root_path = ""
if settings.ROOT_PATH:
    root_path = f"{settings.ROOT_PATH}/"


def prefix_path(path):
    return root_path + path


service_urlpatterns = [
    path('', include('osrd.urls')),
    path('', include('osrd_infra.urls')),
]

urlpatterns = [
    path('admin/' if not settings.WORKSPACE else prefix_path('admin/'), admin.site.urls),
    path('health/', HealthView.as_view()),
    path(root_path, include(service_urlpatterns)),
]
