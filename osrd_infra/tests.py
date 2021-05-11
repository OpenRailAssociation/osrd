# from django.test import TestCase

# Create your tests here.
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from osrd_infra.models import (
    Infra,
    IdentifierDatabase,
    TrackSectionEntity,
)


def new_infra(client):
    url = reverse("infra")
    data = {"name": "my-infra"}
    response = client.post(url, data, format="json")
    return response.data["id"]


def new_identifier(client):
    url = reverse("identifier")
    data = {"name": "gaia"}
    response = client.post(url, data, format="json")
    return response.data["id"]


def track_section_payload(identifier, name, length):
    return [
        {
            "operation": "create_entity",
            "entity_type": "track_section",
            "components": [
                {
                    "component_type": "identifier",
                    "component": {"database": identifier, "name": name},
                },
                {"component_type": "track_section", "component": {"length": length}},
            ],
        }
    ]


class InfraTests(APITestCase):
    url = reverse("infra")

    def test_create_infra(self):
        data = {"name": "my-infra"}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Infra.objects.count(), 1)
        self.assertEqual(Infra.objects.get().name, "my-infra")

    def test_get_infra(self):
        data = {"name": "my-infra"}
        self.client.post(self.url, data, format="json")
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["name"], "my-infra")


class IdentifierTests(APITestCase):
    url = reverse("identifier")

    def test_create_identifier(self):
        data = {"name": "gaia"}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(IdentifierDatabase.objects.count(), 1)
        self.assertEqual(IdentifierDatabase.objects.get().name, "gaia")

    def test_get_infra(self):
        data = {"name": "gaia"}
        self.client.post(self.url, data, format="json")
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["name"], "gaia")

    def test_duplicate_name(self):
        data = {"name": "gaia"}
        self.client.post(self.url, data, format="json")
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class EditionTests(APITestCase):
    def test_create_entity(self):
        infra = new_infra(self.client)
        identifier = new_identifier(self.client)
        url = reverse("edition", kwargs={"pk": infra})
        data = track_section_payload(identifier, "foobar", 200)
        response = self.client.post(url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(TrackSectionEntity.objects.count(), 1)
        self.assertEqual(TrackSectionEntity.objects.get().track_section.length, 200)

    def test_delete_entity(self):
        infra = new_infra(self.client)
        identifier = new_identifier(self.client)
        url = reverse("edition", kwargs={"pk": infra})
        data = track_section_payload(identifier, "foobar", 200)
        response = self.client.post(url, data, format="json")
        entity_id = response.data[0]["entity_id"]
        data = [{"operation": "delete_entity", "entity_id": entity_id}]
        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(TrackSectionEntity.objects.count(), 0)

    def test_add_component(self):
        infra = new_infra(self.client)
        identifier = new_identifier(self.client)
        url = reverse("edition", kwargs={"pk": infra})
        data = track_section_payload(identifier, "foobar", 200)
        response = self.client.post(url, data, format="json")
        entity_id = response.data[0]["entity_id"]
        data = [
            {
                "operation": "add_component",
                "entity_id": entity_id,
                "component_type": "identifier",
                "component": {"database": identifier, "name": "new_identifier"},
            }
        ]
        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(TrackSectionEntity.objects.count(), 1)
        self.assertEqual(TrackSectionEntity.objects.get().identifier_set.count(), 2)

    def test_update_component(self):
        infra = new_infra(self.client)
        identifier = new_identifier(self.client)
        url = reverse("edition", kwargs={"pk": infra})
        data = track_section_payload(identifier, "foobar", 200)
        response = self.client.post(url, data, format="json")
        component_id = response.data[0]["component_ids"][0]
        data = [
            {
                "operation": "update_component",
                "component_id": component_id,
                "component_type": "identifier",
                "update": {"name": "updated_name"},
            }
        ]
        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entity = TrackSectionEntity.objects.get()
        self.assertEqual(entity.identifier_set.count(), 1)
        self.assertEqual(entity.identifier_set.get().name, "updated_name")

    def test_delete_component(self):
        infra = new_infra(self.client)
        identifier = new_identifier(self.client)
        url = reverse("edition", kwargs={"pk": infra})
        data = track_section_payload(identifier, "foobar", 200)
        response = self.client.post(url, data, format="json")
        component_id = response.data[0]["component_ids"][0]
        data = [
            {
                "operation": "delete_component",
                "component_id": component_id,
                "component_type": "identifier",
            }
        ]
        response = self.client.post(url, data, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(TrackSectionEntity.objects.get().identifier_set.count(), 0)
