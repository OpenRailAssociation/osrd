from osrd_infra.serializers import PathSerializer
from django.db import transaction
from rest_framework.generics import get_object_or_404
from rest_framework.viewsets import GenericViewSet
from rest_framework import mixins
from rest_framework.exceptions import ParseError
import requests
from django.conf import settings


from osrd_infra.models import (
    Path,
    Infra,
)


def status_missing_field_keyerror(key_error: KeyError):
    (key,) = key_error.args
    raise ParseError(f"missing field: {key}")


def try_extract_field(manifest, field):
    try:
        return manifest.pop(field)
    except KeyError as e:
        return status_missing_field_keyerror(e)


def request_pathfinding(payload):
    response = requests.post(settings.BACKEND_URL + "pathfinding/routes", json=payload)
    if not response:
        raise ParseError(response.content)
    return response.json()


class PathfindingView(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    serializer_class = PathSerializer
    queryset = Path.objects.order_by("-created")

    @transaction.atomic
    def perform_create(self, serializer):
        waypoints = try_extract_field(self.request.data, "waypoints")
        infra_id = try_extract_field(self.request.data, "infra")
        infra = get_object_or_404(Infra, pk=infra_id)
        if not isinstance(waypoints, list):
            raise ParseError("waypoints: expected a list of list")
        for stop in waypoints:
            if not isinstance(stop, list):
                raise ParseError("waypoints: expected a list of list")
            for waypoint in stop:
                if not isinstance(waypoint, dict):
                    raise ParseError("waypoint: expected a dict")
                for key in ("track_section", "direction", "offset"):
                    if key not in waypoint:
                        raise ParseError(f"waypoint missing field: {key}")

        payload = request_pathfinding({"infra": infra_id, "waypoints": waypoints})

        serializer.save(
            owner=self.request.user.sub,
            namespace=infra.namespace,
            payload=payload,
        )
