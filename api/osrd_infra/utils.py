from dataclasses import dataclass, field
from time import perf_counter
from typing import Dict, List, Optional, Tuple

from django.core.validators import BaseValidator
from pydantic import BaseModel
from pydantic import ValidationError as PydanticValidationError
from rest_framework.exceptions import ValidationError


class PydanticValidator(BaseValidator):
    def __init__(self, pydantic_class: BaseModel):
        self.pydantic_class = pydantic_class
        super().__init__(limit_value=self._get_pydantic_class)

    def _get_pydantic_class(self):
        return self.pydantic_class

    def compare(self, data: Dict, schema: BaseModel):
        try:
            schema.validate(data)
        except PydanticValidationError as e:
            raise ValidationError(str(e), code="invalid")


@dataclass
class Benchmarker:
    steps: List[Tuple[str, float]] = field(default_factory=list)
    stop_time: Optional[float] = None

    def reset(self):
        self.steps = []
        self.stop_time = None

    def step(self, step_name):
        self.steps.append((step_name, perf_counter()))

    def stop(self):
        self.stop_time = perf_counter()

    def print_steps(self, print_callback=print):
        steps_count = len(self.steps)
        for i in range(steps_count):
            step_name, step_start = self.steps[i]
            if i == steps_count - 1:
                step_end = self.stop_time
            else:
                _, step_end = self.steps[i + 1]
            print_callback(f"{step_name.ljust(50)}\t{step_end - step_start:.3f}")

        total_time = self.stop_time - self.steps[0][1]
        print_callback(f"total time: {total_time:.3f}")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.stop()


def make_exception_from_error(response, user_error_type, internal_error_type):

    # Most formatted errors are in json format, but other (asserts) are plain strings
    if "json" in response.headers.get("Content-Type", ""):
        content = response.json()
    else:
        content = response.content

    if response.status_code == 400:
        return user_error_type(content)
    else:
        return internal_error_type(content)
