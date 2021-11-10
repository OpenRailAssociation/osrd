from enum import IntEnum


class Direction(IntEnum):
    START_TO_STOP = 0
    STOP_TO_START = 1


class ApplicableDirection(IntEnum):
    NORMAL = 0
    REVERSE = 1
    BOTH = 2

    def directions(self):
        if self != ApplicableDirection.REVERSE:
            yield Direction.START_TO_STOP
        if self != ApplicableDirection.NORMAL:
            yield Direction.STOP_TO_START
