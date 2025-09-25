from dataclasses import dataclass
from typing import Any, Dict, List
from collections.abc import Iterable


@dataclass(frozen=True)
class Path:
    status: str
    # Path contains "track_section_ranges", "blocks" and "routes".
    # Each has a list of range (begin, end, and either id or track_section)
    path: Dict[str, List]
    length: int
    path_item_positions: Iterable[Any]
