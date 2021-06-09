from django.urls import path
from rest_framework.routers import DefaultRouter

from osrd_infra.models import get_entity_meta
from osrd_infra.views import (
    ALL_ENTITY_VIEWSETS,
    InfraView,
    RollingStockView,
    LightRollingStockView,
    PathfindingView,
    TimetableView,
)
from osrd_infra.views.schema import SchemaView
from osrd_infra.views.train_schedule import TrainScheduleView

router = DefaultRouter(trailing_slash=True)
router.register("infra", InfraView, basename="infra")
router.register("rolling_stock", RollingStockView, basename="rolling_stock")
router.register(
    "light_rolling_stock", LightRollingStockView, basename="light_rolling_stock"
)
router.register("pathfinding", PathfindingView, basename="pathfinding")
router.register("timetable", TimetableView, basename="timetable")
router.register("train_schedule", TrainScheduleView, basename="train_schedule")

for entity_type, entity_viewset in ALL_ENTITY_VIEWSETS:
    entity_name = get_entity_meta(entity_type).name
    router.register("ecs/entity/" + entity_name, entity_viewset, basename=entity_name)

urlpatterns = router.urls + [
    path("schema/", SchemaView.as_view()),
]
