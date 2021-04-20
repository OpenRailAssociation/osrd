from rest_framework.routers import SimpleRouter
from django.urls import path, include

from osrd_infra.views import (
    InfraViewSet,
    TrackSectionViewSet,
    SignalViewSet,
    OperationalPointViewSet,
    SwitchViewSet,
)


entity_router = SimpleRouter()
entity_router.register("infra", InfraViewSet)
entity_router.register("track_section", TrackSectionViewSet)
entity_router.register("switch", SwitchViewSet)
entity_router.register("signal", SignalViewSet)
entity_router.register("operational_point", OperationalPointViewSet)

urlpatterns = [
    path('entity/', include(entity_router.urls)),
    # path('component/', include(component_router.urls)),
]
