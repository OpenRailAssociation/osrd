from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class TimetableV2:
    id: int
    electrical_profile_set_id: Optional[int] = None
    train_ids: Optional[list[int]] = None
