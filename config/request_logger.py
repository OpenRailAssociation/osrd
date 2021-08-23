import logging


logger = logging.getLogger('request_logger')


class RequestLogger:
    __slots__ = ("get_response",)

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        logger.info("got request %s %s", request.method, request.get_full_path())
        return self.get_response(request)
