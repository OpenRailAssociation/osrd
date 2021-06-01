from rest_framework.routers import DefaultRouter

from osrd_infra.models import get_entity_meta
from osrd_infra.views import (
    ALL_ENTITY_VIEWSETS,
    InfraView,
    RollingStockView,
    LightRollingStockView,
)


router = DefaultRouter(trailing_slash=True)
router.register("infra", InfraView, basename="infra")
router.register("rolling_stock", RollingStockView, basename="rolling_stock")
router.register("light_rolling_stock", LightRollingStockView, basename="light_rolling_stock")

for entity_type, entity_viewset in ALL_ENTITY_VIEWSETS:
    entity_name = get_entity_meta(entity_type).name
    router.register("ecs/entity/" + entity_name, entity_viewset, basename=entity_name)

urlpatterns = router.urls
