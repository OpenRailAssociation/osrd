from typing import Any, ClassVar, List, Dict
from fastapi import FastAPI


def process_dependable(f):
    f.is_dependable = True
    return f


def find_dependables(attrs):
    for name, attr in attrs.items():
        if getattr(attr, "is_dependable", False):
            yield name, attr


def make_async_stub(class_name, method_name):
    async def _async_stub():
        raise RuntimeError(
            f"Process {class_name} wasn't initialized, "
            f"thus {class_name}.{method_name} isn't usable. "
            f"Please call {class_name}.setup(app, ...) before starting the app"
        )
    return _async_stub


def make_fake_dependable(class_name, dependable_name, dependable):
    stub = make_async_stub(class_name, dependable_name)
    stub.__name__ = dependable.__name__
    stub.__qualname__ = dependable.__qualname__
    stub.real_dependable = dependable
    return stub


class AsyncProcessMetaclass(type):
    def __new__(cls, name, bases, attrs, inhibit_metaclass=False):
        real_class = super().__new__(cls, name, bases, attrs)
        if inhibit_metaclass:
            return real_class

        for method_name in ("on_startup", "on_shutdown"):
            if method_name not in attrs:
                raise TypeError(f"{name} must implement {method_name}")

        fake_attrs = {
            "setup": real_class.setup,
            "get_process": real_class.get_process,
        }
        fake_dependables = []
        for dep_name, dep in find_dependables(attrs):
            fake_dependable = make_fake_dependable(name, dep_name, dep)
            fake_attrs[dep_name] = fake_dependable
            fake_dependables.append(fake_dependable)

        real_class._fake_dependables = fake_dependables
        return super().__new__(cls, name, (), fake_attrs)


class AsyncProcess(metaclass=AsyncProcessMetaclass, inhibit_metaclass=True):
    """
    Greatly simplifies implementing asynchronous processes,
    which can be interacted with using dependencies.

    ```
    import asyncpg
    from fastapi import FastAPI
    from chartos.utils import AsyncProcess, process_dependable

    class PSQLPool(AsyncProcess):
        def __init__(self, settings):
            self.pool = None
            self.settings = settings

        async def on_startup(self):
            self.pool = await asyncpg.create_pool(**self.settings)

        async def on_shutdown(self):
            await self.pool.close()

        @process_dependable
        async def get(self) -> asyncpg.Connection:
            async with self.pool.acquire() as con:
                yield con


    def make_app() -> FastAPI:
        app = FastAPI()
        settings = {"dsn": "postgres://..."}
        PSQLPool.setup(app, settings)
        return app


    app = make_app()


    @app.get("/test_db")
    async def test_db(conn = Depends(PSQLPool.get)):
        return await conn.execute("select 1;")
    ```
    """

    _fake_dependables: ClassVar[List[Any]]

    @classmethod
    def setup(cls, app: FastAPI, *args, **kwargs):
        """
        Initializes the process for use with a given app instance
        """
        process = cls(*args, **kwargs)
        app.on_event("startup")(process.on_startup)
        app.on_event("shutdown")(process.on_shutdown)
        app.dependency_overrides[cls.get_process] = lambda: process

        for fake_dependable in cls._fake_dependables:
            dependable_name = fake_dependable.__name__
            instance_dependable = getattr(process, dependable_name)
            app.dependency_overrides[fake_dependable] = instance_dependable
        return process

    async def on_startup(self):
        """A hook which runs when the app starts up"""
        raise NotImplementedError

    async def on_shutdown(self):
        """A hook which runs when the app shuts down"""
        raise NotImplementedError

    @classmethod
    def get_process(cls, app: FastAPI):
        return app.dependency_overrides[cls.get_process]()
