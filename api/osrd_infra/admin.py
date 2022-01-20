from django.contrib import admin

from osrd_infra.models import (  # misc; timetable
    MODEL_TO_OBJ,
    AspectModel,
    Infra,
    PathModel,
    RailScriptFunctionModel,
    RollingStock,
    Timetable,
    TrainScheduleModel,
)


@admin.register(Infra)
class InfraAdmin(admin.ModelAdmin):
    list_display = ("name",)
    readonly_fields = ("created", "modified")


admin.site.register(
    [
        # misc
        PathModel,
        RollingStock,
        # timetable
        Timetable,
        TrainScheduleModel,
        RailScriptFunctionModel,
        AspectModel,
    ]
    + [model for model in MODEL_TO_OBJ]
)
