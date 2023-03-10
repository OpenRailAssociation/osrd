from django.contrib.gis.db import models
from osrd_schemas.infra import (
    ALL_OBJECT_TYPES,
    RAILJSON_INFRA_VERSION,
    BufferStop,
    Catenary,
    Detector,
    OperationalPoint,
    Route,
    Signal,
    SpeedSection,
    Switch,
    SwitchType,
    TrackSection,
    TrackSectionLink,
)

from osrd_infra.utils import PydanticValidator

MODEL_TO_OBJ = {}
OBJ_TO_MODEL = {}


class Infra(models.Model):
    name = models.CharField(max_length=128)
    railjson_version = models.CharField(editable=False, max_length=16, default=RAILJSON_INFRA_VERSION)
    owner = models.UUIDField(editable=False, default="00000000-0000-0000-0000-000000000000")
    version = models.CharField(editable=False, max_length=40, default="1")
    generated_version = models.CharField(editable=False, max_length=40, null=True)
    locked = models.BooleanField(default=False)
    created = models.DateTimeField(editable=False, auto_now_add=True)
    modified = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class OperationalPointModel(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    data = models.JSONField(validators=[PydanticValidator(OperationalPoint)])

    class Meta:
        verbose_name_plural = "operational points"
        unique_together = (("infra", "obj_id"),)


class RouteModel(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    data = models.JSONField(validators=[PydanticValidator(Route)])

    class Meta:
        verbose_name_plural = "routes"
        unique_together = (("infra", "obj_id"),)


class SwitchTypeModel(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    data = models.JSONField(validators=[PydanticValidator(SwitchType)])

    class Meta:
        verbose_name_plural = "switch types"
        unique_together = (("infra", "obj_id"),)


class SwitchModel(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    data = models.JSONField(validators=[PydanticValidator(Switch)])

    class Meta:
        verbose_name_plural = "switches"
        unique_together = (("infra", "obj_id"),)


class TrackSectionLinkModel(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    data = models.JSONField(validators=[PydanticValidator(TrackSectionLink)])

    class Meta:
        verbose_name_plural = "track section links"
        unique_together = (("infra", "obj_id"),)


class TrackSectionModel(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    data = models.JSONField(validators=[PydanticValidator(TrackSection)])

    class Meta:
        verbose_name_plural = "track sections"
        unique_together = (("infra", "obj_id"),)


class SpeedSectionModel(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    data = models.JSONField(validators=[PydanticValidator(SpeedSection)])

    class Meta:
        verbose_name_plural = "speed sections"
        unique_together = (("infra", "obj_id"),)


class CatenaryModel(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    data = models.JSONField(validators=[PydanticValidator(Catenary)])

    class Meta:
        verbose_name_plural = "catenaries"
        unique_together = (("infra", "obj_id"),)


class SignalModel(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    data = models.JSONField(validators=[PydanticValidator(Signal)])

    class Meta:
        verbose_name_plural = "signals"
        unique_together = (("infra", "obj_id"),)


class BufferStopModel(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    data = models.JSONField(validators=[PydanticValidator(BufferStop)])

    class Meta:
        verbose_name_plural = "buffer stops"
        unique_together = (("infra", "obj_id"),)


class DetectorModel(models.Model):
    infra = models.ForeignKey(Infra, on_delete=models.CASCADE)
    obj_id = models.CharField(max_length=255)
    data = models.JSONField(validators=[PydanticValidator(Detector)])

    class Meta:
        verbose_name_plural = "detectors"
        unique_together = (("infra", "obj_id"),)


def _into_model(obj, infra=None):
    obj_type = type(obj)
    if obj_type not in OBJ_TO_MODEL:
        raise ValueError(f"{obj_type.__name__} not a obj")
    model_type = OBJ_TO_MODEL[obj_type]
    data = obj.dict()
    obj_id = data["id"]
    return model_type(obj_id=obj_id, data=data, infra=infra)


def _into_obj(model):
    model_type = type(model)
    if model_type not in MODEL_TO_OBJ:
        raise ValueError(f"{model_type.__name__} not a model")
    obj_type = MODEL_TO_OBJ[model_type]
    return obj_type(**model.data)


ALL_MODELS = {m.__name__: m for m in models.Model.__subclasses__()}
for obj in ALL_OBJECT_TYPES:
    obj_name = obj.__name__
    model_name = f"{obj_name}Model"
    if model_name not in ALL_MODELS:
        raise ValueError(f"Missing model for obj {obj_name}")
    model = ALL_MODELS[model_name]

    # Save in maps for conversion
    MODEL_TO_OBJ[model] = obj
    OBJ_TO_MODEL[obj] = model

    # Add usefull methods
    obj.into_model = _into_model
    model.into_obj = _into_obj
