from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class Path:
    status: str
    # Path contains "track_section_ranges", "blocks" and "routes".
    # Each has a list of range (begin, end, and either id or track_section)
    path: dict[str, list]
    length: int
    path_item_positions: Iterable[Any]
    backtrack_path_items: Iterable[int]
