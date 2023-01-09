from rest_framework.routers import DefaultRouter

from osrd_infra.views import (
    InfraView,
    LightRollingStockView,
    PathfindingView,
    RollingStockView,
    TimetableView,
    VersionView,
)
from osrd_infra.views.stdcm import STDCM
from osrd_infra.views.train_schedule import TrainScheduleView

router = DefaultRouter(trailing_slash=True)
router.register("infra", InfraView, basename="infra")
router.register("rolling_stock", RollingStockView, basename="rolling_stock")
router.register("light_rolling_stock", LightRollingStockView, basename="light_rolling_stock")
router.register("pathfinding", PathfindingView, basename="pathfinding")
router.register("timetable", TimetableView, basename="timetable")
router.register("train_schedule", TrainScheduleView, basename="train_schedule")
router.register("version", VersionView, basename="version")
router.register("stdcm", STDCM, basename="stdcm")

urlpatterns = router.urls
