from uvicorn.workers import UvicornWorker


class UvicornWorker(UvicornWorker):
    CONFIG_KWARGS = {"lifespan": "off"}
