import os

import requests
from django.conf import settings
from django.http import JsonResponse
from rest_framework.decorators import action
from rest_framework.exceptions import APIException
from rest_framework.viewsets import ViewSet

from osrd_infra.utils import make_exception_from_error


class InternalVersionError(APIException):
    status_code = 500
    default_detail = "An internal error occurred while fetching versions"
    default_code = "internal_version_error"


class VersionView(
    ViewSet,
):
    @action(detail=False, methods=["get"])
    def api(self, request):
        describe = os.environ.get("OSRD_GIT_DESCRIBE", None)
        if not describe:
            describe = None
        return JsonResponse({"git_describe": describe})

    @action(detail=False, methods=["get"])
    def core(self, request):
        response = requests.post(
            f"{settings.OSRD_BACKEND_URL}/version",
            headers={"Authorization": "Bearer " + settings.OSRD_BACKEND_TOKEN},
        )
        if not response:
            raise make_exception_from_error(response, InternalVersionError, InternalVersionError)
        response = response.json()
        if not response.get("git_describe", None):
            response["git_describe"] = None
        return JsonResponse(response)
