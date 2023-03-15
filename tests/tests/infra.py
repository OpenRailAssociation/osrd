from dataclasses import dataclass


@dataclass(frozen=True)
class Infra:
    id: int
    name: str
