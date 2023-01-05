from django.contrib import admin

from osrd_infra.models import (  # misc; timetable
    MODEL_TO_OBJ,
    ElectricalProfileSet,
    Infra,
    PathModel,
    Project,
    RollingStock,
    Scenario,
    Study,
    Timetable,
    TrainScheduleModel,
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
        TrainScheduleModel,
        # study
        Scenario,
        Study,
        Project,
    ]
    + [model for model in MODEL_TO_OBJ]
)
