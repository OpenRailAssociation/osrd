from collections.abc import Sequence
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
    steps: Sequence[Any]
    geographic: Any
    schematic: Any
