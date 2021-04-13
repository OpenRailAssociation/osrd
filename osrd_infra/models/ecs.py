from django.contrib.gis.db import models

class EntityID(models.Model):
    class Type(models.IntegerChoices):
        TRACK_SECTION = 0

    type_id = models.IntegerField(choices=Type.choices)


class Component(models.Model):
    entity_id = models.ForeignKey("EntityID", on_delete=models.CASCADE)

    class Meta:
        abstract = True


class Entity(models.Model):
    entity_id = models.ForeignKey("EntityID", on_delete=models.CASCADE)

    class Meta:
        abstract = True
