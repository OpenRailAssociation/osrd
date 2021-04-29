from service_core.gateway_auth import GatewayUser


class LocalUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.user = GatewayUser(
            '00000000-0000-0000-0000-000000000000',
            'joseph.marchand',
            'Joseph',
            'Marchand',
            'joseph.marchand@sncf.fr',
            [],
            'short'
        )
        return self.get_response(request)
