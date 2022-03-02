from enum import IntEnum


class Direction(IntEnum):
    START_TO_STOP = 0
    STOP_TO_START = 1


class ApplicableDirection(IntEnum):
    START_TO_STOP = 0
    STOP_TO_START = 1
    BOTH = 2

    def directions(self):
        if self != ApplicableDirection.STOP_TO_START:
            yield Direction.START_TO_STOP
        if self != ApplicableDirection.START_TO_STOP:
            yield Direction.STOP_TO_START
