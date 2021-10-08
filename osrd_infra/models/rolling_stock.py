from django.db import models
from django.contrib.postgres.fields import ArrayField
from django.utils.translation import gettext_lazy as _

from osrd_infra.utils import JSONSchemaValidator

EFFORT_CURVE_SCHEMA = {
    "type": "array",
    "items": {
        "type": "object",
        "properties": {
            "speed": {"type": "number"},
            "max_effort": {"type": "number"},
        },
        "required": ["speed", "max_effort"],
    },
    "title": "schema",
}


EFFORT_CURVE_MAP_SCHEMA = {
    "type": "object",
    "additionalProperties": EFFORT_CURVE_SCHEMA,
}


ROLLING_RESISTANCE_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"const": "davis"},
        "A": {"type": "number", "minimum": 0},
        "B": {"type": "number", "minimum": 0},
        "C": {"type": "number", "minimum": 0},
    },
    "required": [
        "type",
        "A",
        "B",
        "C",
    ],
}


COPIED_KEYS_V1_TO_V2 = (
    "id",
    "length",
    "max_speed",
    "startup_time",
    "startup_acceleration",
    "comfort_acceleration",
    "gamma",
    "gamma_type",
    "inertia_coefficient",
    "features",
)


def migrate_v1_to_v2(old):
    new = {migrated_key: old[migrated_key] for migrated_key in COPIED_KEYS_V1_TO_V2}

    new["version"] = "2.0"
    new["source"] = old["id"]
    new["verbose_name"] = old["id"]
    new["type"] = None
    new["sub_type"] = None
    new["series"] = None
    new["sub_series"] = None
    new["variant"] = None
    new["units_count"] = 1

    new["effort_curves"] = {
        "default_curve": [
            (point["speed"], point["max_effort"])
            for point in old["tractive_effort_curve"]
        ]
    }

    new["effort_curve_profiles"] = {
        "default_curve_profile": [{"condition": None, "effort_curve": "default_curve"}]
    }

    new["rolling_resistance_profiles"] = {
        "default_resistance_profile": [
            {"id": "normal", "condition": None, "resistance": old["rolling_resistance"]}
        ]
    }

    new["liveries"] = []
    new["power_class"] = 5

    new["masses"] = [
        {"id": "default_mass", "load_state": "NORMAL_LOAD", "mass": old["mass"]}
    ]

    new["modes"] = [
        {
            "type": "diesel",
            "rolling_resistance_profile": "default_resistance_profile",
            "effort_curve_profile": "default_curve_profile",
        }
    ]
    return new


class RollingStock(models.Model):
    name = models.CharField(
        max_length=255,
        unique=True,
        help_text=_("A unique identifier for this rolling stock"),
    )

    owner = models.UUIDField(
        editable=False, default="00000000-0000-0000-0000-000000000000"
    )

    length = models.FloatField(
        help_text=_("The length of the train, in meters"),
    )

    mass = models.FloatField(help_text=_("The mass of the train, in kilograms"))

    inertia_coefficient = models.FloatField(
        help_text=_(
            "The inertia coefficient. It will be multiplied with the mass "
            "of the train to get its effective mass"
        ),
    )

    rolling_resistance = models.JSONField(
        help_text=_("The formula to use to compute rolling resistance"),
        validators=[JSONSchemaValidator(limit_value=ROLLING_RESISTANCE_SCHEMA)],
    )

    capabilities = ArrayField(
        models.CharField(max_length=255),
        help_text=_("A list of features the train exhibits, such as ERTMS support"),
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

    timetable_gamma = models.FloatField(
        help_text=_(
            "The maximum braking coefficient, for timetabling purposes, in m/s^2"
        ),
    )

    tractive_effort_curves = models.JSONField(
        help_text=_(
            "A set of curves mapping speed (in m/s) to maximum traction (in newtons)"
        ),
        validators=[JSONSchemaValidator(limit_value=EFFORT_CURVE_MAP_SCHEMA)],
    )

    traction_mode = models.CharField(max_length=128)

    power_class = models.PositiveIntegerField()

    image = models.ImageField(null=True, blank=True)

    def __str__(self):
        return self.name

    def to_railjson(self):
        return migrate_v1_to_v2({
            "id": f"rolling_stock.{self.id}",
            "length": self.length,
            "mass": self.mass,
            "inertia_coefficient": self.inertia_coefficient,
            "rolling_resistance": self.rolling_resistance,
            "features": self.capabilities,
            "max_speed": self.max_speed,
            "startup_time": self.startup_time,
            "startup_acceleration": self.startup_acceleration,
            "comfort_acceleration": self.comfort_acceleration,
            "gamma": self.timetable_gamma,
            "gamma_type": "CONST",
            "tractive_effort_curve": next(iter(self.tractive_effort_curves.values())),
        })
