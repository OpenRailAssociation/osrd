from rest_framework.routers import SimpleRouter
from django.urls import path, include

from osrd_infra.models import get_entity_meta
from osrd_infra.views import (
    InfraViewSet,
    ALL_ENTITY_VIEWSETS,
    InfraRailJSONView,
    InfraEditionView,
    InfraView,
    GeoJsonView,
)


entity_router = SimpleRouter()
entity_router.register("infra", InfraViewSet)

for entity_type, entity_viewset in ALL_ENTITY_VIEWSETS:
    entity_name = get_entity_meta(entity_type).name
    entity_router.register(entity_name, entity_viewset, basename=entity_name)

urlpatterns = [
    path("ecs/entity/", include(entity_router.urls)),
    path("railjson/infra/<int:pk>/", InfraRailJSONView.as_view()),
    path("edit/infra/<int:pk>/", InfraEditionView.as_view()),
    path("geojson/infra/<int:pk>/", GeoJsonView.as_view()),
    path("infra/", InfraView.as_view()),
]
