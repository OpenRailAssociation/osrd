from django.db import models


class OsrdSearchOperationalPoint(models.Model):
    class Meta:
        db_table = "osrd_search_operationalpoint"
        managed = False
