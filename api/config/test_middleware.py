from service_core.gateway_auth import GatewayUser
from rest_framework.authentication import BaseAuthentication


def make_test_user():
    return GatewayUser(
        '00000000-0000-0000-0000-000000000000',
        'joseph.marchand',
        'Joseph',
        'Marchand',
        'joseph.marchand@sncf.fr',
        [],
        'short'
    )


class LocalUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.user = make_test_user()
        return self.get_response(request)


class TestGatewayAuth(BaseAuthentication):
    def authenticate(self, request):
        return make_test_user(), None
