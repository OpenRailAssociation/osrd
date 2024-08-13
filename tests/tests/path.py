from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, Iterable


@dataclass(frozen=True)
class Path:
    status: str
    blocks: Iterable[Any]
    routes: Iterable[Any]
    track_section_ranges: Sequence[Any]
    length: int
    path_item_positions: Iterable[Any]
