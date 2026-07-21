from datetime import timedelta
from typing import Annotated

from pydantic import BeforeValidator, PlainSerializer


def validate_one_of(instance, *fields: str):
    """Raise if not exactly one of the given fields is set."""
    set_count = sum(getattr(instance, f) is not None for f in fields)
    if set_count != 1:
        raise ValueError(f"Exactly one of {', '.join(fields)} must be set.")
    return instance


def timedelta_to_int_ms(delta: timedelta) -> int:
    """Convert a timedelta to an int in ms."""
    return int(delta.total_seconds() * 1000)


def ensure_timedelta(value: int | timedelta) -> timedelta:
    """Convert the given value to a timedelta."""
    if isinstance(value, int):
        return timedelta(milliseconds=value)
    return value


OffsetInMs = Annotated[
    timedelta, BeforeValidator(ensure_timedelta), PlainSerializer(timedelta_to_int_ms)
]
