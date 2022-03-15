from fastapi import FastAPI
from typing import TypeVar, Generic


T = TypeVar("T")


class ValueDependable(Generic[T]):
    __slots__ = ("name",)

    def __init__(self, name):
        self.name = name

    def setup(self, app: FastAPI, value: T):
        def override():
            return value
        app.dependency_overrides[self] = override

    def __call__(self):
        raise RuntimeError(
            f"this dependable wasn't configured: {self.name}. "
            f"Please set it up before the app starts using: "
            f"{self.name}.setup(app, value)"
        )
