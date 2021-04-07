"""osrd URL Configuration
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings

from service_core.internal_views import HealthView

service_urlpatterns = [
    path('', include('osrd.urls')),
    path('infra/', include('infra.urls')),
]

urlpatterns = [
    path('admin/' if not settings.WORKSPACE else f'{settings.ROOT_PATH}/admin/', admin.site.urls),
    path('health/', HealthView.as_view()),
    path(f'{settings.ROOT_PATH}/', include(service_urlpatterns)),
]
