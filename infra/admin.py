from django.contrib import admin
from django.contrib.admin import ModelAdmin

from infra.models import Infra


@admin.register(Infra)
class InfraModelAdmin(ModelAdmin):
    pass