from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from osrd_infra.models import Infra


def new_infra(client):
    url = reverse("infra-list")
    data = {"name": "my-infra"}
    response = client.post(url, data, format="json")
    return response.data["id"]


class InfraTests(APITestCase):
    url = reverse("infra-list")

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
