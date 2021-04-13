from django.contrib import admin
from django.contrib.admin import ModelAdmin

from .models import *


@admin.register(EntityID)
class ECSModelAdmin(ModelAdmin):
    pass

@admin.register(TrackSectionLocation)
@admin.register(TrackSectionRange)
@admin.register(Identifier)
class ComponentsModelAdmin(ModelAdmin):
    pass

@admin.register(Infra)
@admin.register(TrackSection)
@admin.register(Switch)
@admin.register(TrackSectionLink)
@admin.register(Signal)
@admin.register(OperationalPoint)
@admin.register(OperationalPointPart)
class InfraModelAdmin(ModelAdmin):
    pass
