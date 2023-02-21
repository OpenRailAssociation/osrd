from typing import Dict

from django.contrib.postgres.fields import ArrayField
from django.db import models, transaction
from django.utils.translation import gettext_lazy as _
from osrd_schemas.infra import LoadingGaugeType
from osrd_schemas.rolling_stock import (
    RAILJSON_ROLLING_STOCK_VERSION,
    EffortCurves,
    Gamma,
    RollingResistance,
)
from osrd_schemas.rolling_stock import RollingStock as RollingStockSchema

from osrd_infra.utils import PydanticValidator


class RollingStock(models.Model):
    version = models.CharField(editable=False, max_length=16, default=RAILJSON_ROLLING_STOCK_VERSION)
    name = models.CharField(
        max_length=255,
        unique=True,
        help_text=_("A unique identifier for this rolling stock"),
    )
    effort_curves = models.JSONField(
        help_text=_("A group of curves mapping speed (in m/s) to maximum traction (in newtons)"),
        validators=[PydanticValidator(EffortCurves)],
    )
    power_class = models.CharField(
        max_length=255,
        help_text=_("The power usage class of the train (optional because it is specific to SNCF)"),
        null=True,
    )
    length = models.FloatField(
        help_text=_("The length of the train, in meters"),
    )
    max_speed = models.FloatField(
        help_text=_("The maximum operational speed, in m/s"),
    )
    startup_time = models.FloatField(
        help_text=_("The time the train takes before it can start accelerating"),
    )
    startup_acceleration = models.FloatField(
        help_text=_("The maximum acceleration during startup, in m/s^2"),
    )
    comfort_acceleration = models.FloatField(
        help_text=_("The maximum operational acceleration, in m/s^2"),
    )
    gamma = models.JSONField(
        validators=[PydanticValidator(Gamma)],
        help_text=_("The const or max braking coefficient, for timetabling purposes, in m/s^2"),
    )
    inertia_coefficient = models.FloatField(
        help_text=_(
            "The inertia coefficient. It will be multiplied with the mass of the train to get its effective mass"
        ),
    )
    features = ArrayField(
        models.CharField(max_length=255),
        blank=True,
        help_text=_("A list of features the train exhibits, such as ERTMS support"),
    )
    mass = models.FloatField(help_text=_("The mass of the train, in kilograms"))
    rolling_resistance = models.JSONField(
        help_text=_("The formula to use to compute rolling resistance"),
        validators=[PydanticValidator(RollingResistance)],
    )
    loading_gauge = models.CharField(max_length=16, choices=[(x.value, x.name) for x in LoadingGaugeType])
    image = models.ImageField(null=True, blank=True)
    metadata = models.JSONField(
        help_text=_(
            "Dictionary of optional properties used in the frontend to display\
            the rolling stock: detail, number, reference, family, type, grouping,\
            series, subseries, unit"
        ),
        default=dict,
    )

    def __str__(self):
        return self.name

    @staticmethod
    def from_schema(sch):
        return RollingStock(**sch.dict())

    def to_schema(self):
        data = self.__dict__.copy()
        data.pop("_state")
        data.pop("image")
        data.pop("id")
        return RollingStockSchema(**data)

    @staticmethod
    @transaction.atomic
    def import_railjson(rolling_stock_dict: Dict, force: bool = False):
        # Parse rolling stock payload
        rs_obj: RollingStockSchema = RollingStockSchema.parse_obj(rolling_stock_dict)

        if force:
            return RollingStock.objects.update_or_create(**rs_obj.dict())
        return RollingStock.objects.create(**rs_obj.dict())


class RollingStockImage(models.Model):
    image = models.BinaryField(null=False, blank=False)

    class Meta:
        abstract = True
        verbose_name_plural = "rolling stock images"


class RollingStockCompoundImage(RollingStockImage):
    class Meta:
        db_table = "osrd_infra_rollingstockimage"
        managed = False
        verbose_name_plural = "rolling stock compound images"


class RollingStockLivery(models.Model):
    name = models.CharField(max_length=255, help_text=_("Name of the livery"), default="default")
    rolling_stock = models.ForeignKey(RollingStock, related_name="liveries", on_delete=models.CASCADE)
    compound_image = models.OneToOneField(RollingStockCompoundImage, null=True, on_delete=models.CASCADE)

    class Meta:
        verbose_name_plural = "rolling stocks liveries"
        unique_together = (("rolling_stock", "name"),)

    def __str__(self):
        return self.name


class RollingStockSeparatedImage(RollingStockImage):
    livery = models.ForeignKey(RollingStockLivery, on_delete=models.CASCADE)
    order = models.IntegerField(help_text=_("Position of this image in its livery"), default=0)

    class Meta:
        db_table = "osrd_infra_rollingstockimage"
        unique_together = (("livery", "order"),)
        verbose_name_plural = "rolling stock separated images"
