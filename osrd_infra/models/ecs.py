from django.contrib.gis.db import models

class EntityID(models.Model):
    id = models.BigAutoField(primary_key=True)

    class Type(models.IntegerChoices):
        TRACK_SECTION = 0
        TRACK_SECTION_LINK = 1
        SIGNAL = 2
    type_id = models.IntegerField(choices=Type.choices)


class Component(models.Model):
    entity_id = models.ForeignKey("EntityID", on_delete=models.CASCADE)

    class Meta:
        abstract = True


class Entity(models.Model):
    entity_id = models.OneToOneField("EntityID", on_delete=models.CASCADE, primary_key=True)

    class Meta:
        abstract = True
