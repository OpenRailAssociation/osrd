from typing import Dict
from dataclasses import dataclass, field
from django.contrib.gis.geos import GEOSGeometry
from django.conf import settings
from requests import post


def geom_to_geosjon_dict(geom: GEOSGeometry) -> Dict:
    return {"type": geom.__class__.__name__, "coordinates": geom.coords}


@dataclass(eq=False)
class LayerObject:
    _geom_geo: GEOSGeometry
    _geom_sch: GEOSGeometry
    _metadata: Dict = field(default_factory=dict)

    def add_metadata(self, name, value):
        self._metadata[name] = value

    def to_payload_object(self):
        return {
            "geom_geo": geom_to_geosjon_dict(self._geom_geo),
            "geom_sch": geom_to_geosjon_dict(self._geom_sch),
            **self._metadata,
        }


class LayerCreator:
    __slots__ = ("name", "layer", "version", "payload_size")

    def __init__(self, name, version, payload_size=512):
        self.name = name
        self.version = version
        self.layer = []
        self.payload_size = payload_size

    def create_object(self, geo, sch) -> LayerObject:
        layer_object = LayerObject(geo, sch)
        self.layer.append(layer_object)
        return layer_object

    def create(self):
        layer_slug = f"osrd_{self.name}"
        payload = [layer_object.to_payload_object() for layer_object in self.layer]

        for i in range(0, len(payload), self.payload_size):
            response = post(
                f"{settings.CHARTIS_URL}push/{layer_slug}/insert/?version={self.version}",
                json=payload[i: i + self.payload_size],
                headers={"Authorization": "Bearer " + settings.CHARTIS_TOKEN},
            )
            if response.status_code != 201:
                raise Exception(response.text)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback):
        self.create()
