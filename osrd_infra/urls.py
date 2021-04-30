from rest_framework.routers import SimpleRouter
from django.urls import path, include

from osrd_infra.views import (
    InfraViewSet,
    TrackSectionViewSet,
    TrackSectionLinkViewSet,
    SignalViewSet,
    OperationalPointViewSet,
    SwitchViewSet,
    InfraRailJSONSerializer,
    InfraEdition,
)


entity_router = SimpleRouter()
entity_router.register("infra", InfraViewSet)
entity_router.register("track_section", TrackSectionViewSet, basename="track_section")
entity_router.register(
    "track_section_link", TrackSectionLinkViewSet, basename="track_section_link"
)
entity_router.register("switch", SwitchViewSet, basename="switch")
entity_router.register("signal", SignalViewSet, basename="signal")
entity_router.register(
    "operational_point", OperationalPointViewSet, basename="operational_point"
)

urlpatterns = [
    path("entity/", include(entity_router.urls)),
    path("railjson/infra/<int:pk>/", InfraRailJSONSerializer.as_view()),
    path("edit/infra/<int:pk>/", InfraEdition.as_view()),
]
