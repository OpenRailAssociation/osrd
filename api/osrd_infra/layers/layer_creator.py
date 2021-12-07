from django.conf import settings
from requests import post


class LayerCreator:
    __slots__ = ("name", "layer", "version", "payload_size")

    def __init__(self, name, version, payload_size=512):
        self.name = name
        self.version = version
        self.layer = []
        self.payload_size = payload_size

    def add(self, object):
        self.layer.append(object)

    def create(self):
        for i in range(0, len(self.layer), self.payload_size):
            index_end = i + self.payload_size
            response = post(
                f"{settings.CHARTIS_URL}/push/{self.name}/insert/?version={self.version}",
                json=self.layer[i:index_end],
                headers={"Authorization": "Bearer " + settings.CHARTIS_TOKEN},
            )
            if response.status_code != 201:
                raise Exception(response.text)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback):
        self.create()
