from dataclasses import dataclass, field
from time import perf_counter
from typing import List, Optional, Tuple

import jsonschema
import numpy as np
from django.contrib.gis.geos import LineString
from django.core.validators import BaseValidator
from rest_framework.exceptions import ValidationError


class JSONSchemaValidator(BaseValidator):
    def compare(self, data, schema):
        try:
            jsonschema.validate(data, schema)
        except jsonschema.exceptions.ValidationError as e:
            raise ValidationError(e.message, code="invalid")


def geo_transform(gis_object):
    gis_object.transform(4326)
    return gis_object


def reverse_format(object_id):
    return int(object_id.split(".")[1])


def line_string_slice_points(line_string, begin_normalized, end_normalized):
    if begin_normalized > end_normalized:
        # Compute the line string from end to start then reverse the result
        res = line_string_slice(line_string, end_normalized, begin_normalized)
        res.reverse()
        return res

    points = line_string.array
    length = line_string.length
    norm_distance = 0
    i = 0

    # Add first point
    positions = [line_string.interpolate_normalized(begin_normalized)]

    # Skip first points
    while norm_distance <= begin_normalized and i + 1 < len(points):
        norm_distance += np.linalg.norm(points[i] - points[i + 1]) / length
        i += 1

    # Add intermediate points
    while norm_distance < end_normalized and i + 1 < len(points):
        positions.append(list(points[i]))
        norm_distance += np.linalg.norm(points[i] - points[i + 1]) / length
        i += 1

    # Add last point
    positions.append(line_string.interpolate_normalized(end_normalized))
    return positions


def line_string_slice(line_string, begin_normalized, end_normalized):
    points = line_string_slice_points(line_string, begin_normalized, end_normalized)
    return LineString(points)


def track_section_range_geom(track_section, start_offset, end_offset):
    length = track_section.track_section.length
    begin_normalized = start_offset / length
    end_normalized = end_offset / length
    geo = track_section.geo_line_location.geographic
    sch = track_section.geo_line_location.schematic
    res = []
    for geom in (geo, sch):
        sliced = line_string_slice(geo, begin_normalized, end_normalized)
        res.append(sliced)
    return tuple(res)


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
