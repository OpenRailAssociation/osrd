from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True)
class Path:
    id: int
    owner: str
    created: str
    length: float
    slopes: Iterable[Any]
    curves: Iterable[Any]
    steps: Iterable[Any]
    geographic: Any
    schematic: Any
