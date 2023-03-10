from django.contrib import admin

from osrd_infra.models import (  # misc; timetable
    MODEL_TO_OBJ,
    Document,
    ElectricalProfileSet,
    Infra,
    PathModel,
    Project,
    RollingStock,
    Scenario,
    SimulationOutput,
    Study,
    Timetable,
    TrainSchedule,
)


@admin.register(Infra)
class InfraAdmin(admin.ModelAdmin):
    list_display = ("name",)
    readonly_fields = ("version", "generated_version", "railjson_version")


admin.site.register(
    [
        # misc
        PathModel,
        RollingStock,
        ElectricalProfileSet,
        # timetable
        Timetable,
        TrainSchedule,
        SimulationOutput,
        # study
        Document,
        Scenario,
        Study,
        Project,
    ]
    + [model for model in MODEL_TO_OBJ]
)
