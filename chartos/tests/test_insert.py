import pytest
import shapely.geometry

from .test_data import campus_sncf_gps


class MVTClient:
    __slots__ = ("client", "layer", "version", "pattern")

    def __init__(self, client, layer, version, pattern):
        self.client = client
        self.layer = layer
        self.version = version
        self.pattern = pattern

    @staticmethod
    async def init(client, layer: str, version: str, view: str):
        metadata_req = await client.get(
            f"/layer/{layer}/mvt/{view}/",
            params={"version": version}
        )
        assert metadata_req.status_code == 200
        pattern = metadata_req.json()["tiles"][0]
        return MVTClient(client, layer, version, pattern)

    async def insert(self, insert_payload):
        response = await self.client.post(
            f"/push/{self.layer}/insert/",
            params={"version": self.version},
            json=insert_payload
        )
        assert response.status_code == 201
        return response.json()

    async def get_tile(self, z, x, y):
        url = self.pattern.format(x=x, y=y, z=z)
        res = await self.client.get(url)
        assert res.status_code == 200
        return res.read()


@pytest.mark.asyncio
async def test_insert(client):
    test_geom = shapely.geometry.mapping(campus_sncf_gps)

    mvt_client = await MVTClient.init(
        client,
        "osrd_track_section",
        "nasty&version",
        "geo"
    )

    assert (await mvt_client.get_tile(14, 8299, 5632)) == b""

    insert_payload = [
        {"entity_id": 1, "geom_geo": test_geom, "geom_sch": test_geom, "components": {"test": 42.14159}}
    ]
    await mvt_client.insert(insert_payload)

    assert (await mvt_client.get_tile(14, 8299, 5632)) != b""
