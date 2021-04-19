from rest_framework.routers import SimpleRouter

from osrd_infra.views import (
    InfraViewSet,
    TrackSectionViewSet,
    SignalViewSet,
    OperationalPointViewSet,
    SwitchViewSet,
)


router = SimpleRouter()
router.register("infra", InfraViewSet, basename="infra")
router.register("track_section", TrackSectionViewSet, basename="track_section")
router.register("signal", SignalViewSet, basename="signal")
router.register(
    "operational_point", OperationalPointViewSet, basename="operational_point"
)
router.register("switch", SwitchViewSet, basename="switch")


urlpatterns = [] + router.urls


# lister les objets dans une infra
# faire les CRUD par objet
