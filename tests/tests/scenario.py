from dataclasses import dataclass


@dataclass(frozen=True)
class Scenario:
    project: int
    op_study: int
    scenario: int
    infra: int
    timetable: int
