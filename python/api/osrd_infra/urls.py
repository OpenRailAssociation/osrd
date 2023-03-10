from django.urls import include, path
from rest_framework_nested import routers

from osrd_infra.views import (
    InfraView,
    LightRollingStockView,
    PathfindingView,
    ProjectView,
    RollingStockLiveryView,
    RollingStockView,
    ScenarioView,
    StudyView,
    TimetableView,
    VersionView,
)
from osrd_infra.views.stdcm import STDCM
from osrd_infra.views.train_schedule import TrainScheduleView

router = routers.DefaultRouter(trailing_slash=True)
router.register("infra", InfraView, basename="infra")
router.register("rolling_stock", RollingStockView, basename="rolling_stock")
router.register("light_rolling_stock", LightRollingStockView, basename="light_rolling_stock")
router.register("pathfinding", PathfindingView, basename="pathfinding")
router.register("timetable", TimetableView, basename="timetable")
router.register("train_schedule", TrainScheduleView, basename="train_schedule")
router.register("version", VersionView, basename="version")
router.register("stdcm", STDCM, basename="stdcm")
router.register("projects", ProjectView, basename="projects")

project_router = routers.NestedSimpleRouter(router, "projects", lookup="project")
project_router.register("studies", StudyView, basename="studies")
study_router = routers.NestedSimpleRouter(project_router, "studies", lookup="study")
study_router.register("scenarios", ScenarioView, basename="scenarios")

rolling_stock_router = routers.NestedSimpleRouter(router, "rolling_stock", lookup="rolling_stock")
rolling_stock_router.register("livery", RollingStockLiveryView, basename="rolling_stock_livery")


urlpatterns = [
    path("", include(router.urls)),
    path("", include(rolling_stock_router.urls)),
    path("", include(project_router.urls)),
    path("", include(study_router.urls)),
]
