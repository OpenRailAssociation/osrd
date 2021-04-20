from django.contrib import admin
from django.contrib.admin import ModelAdmin

from osrd_infra.models import *


class TrackSectionInline(admin.TabularInline):
    model = TrackSectionComponent
    max_num = 1
    extra = 1


class IdentifierInline(admin.TabularInline):
    model = IdentifierComponent
    extra = 1


class TrackSectionLinkInline(admin.TabularInline):
    model = TrackSectionLinkComponent
    extra = 1


@admin.register(TrackSectionEntity)
class TrackSectionAdmin(ModelAdmin):
    inlines = (IdentifierInline, TrackSectionInline)


@admin.register(SwitchEntity)
class SwitchAdmin(ModelAdmin):
    inlines = (IdentifierInline, TrackSectionLinkInline)


admin.site.register(
    [
        # generic components
        TrackSectionLocationComponent,
        TrackSectionRangeComponent,
        IdentifierComponent,
        TrackSectionLinkComponent,
        # misc
        Infra,
        IdentifierDatabase,
    ]
)
