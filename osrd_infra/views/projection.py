from rest_framework.exceptions import ParseError
from dataclasses import dataclass


def validate_path(path):
    if type(path) is not list:
        raise ParseError(f"path: expected list got {type(path)}")
    for track_range in path:
        if type(track_range) is not dict:
            raise ParseError(
                f"tracksection range: expected dict got {type(track_range)}"
            )
        for key in ("track_section", "begin", "end"):
            if key not in track_range:
                raise ParseError(f"tracksection range: doesn't contain '{key}' key")
            if not isinstance(track_range[key], (int, float)):
                raise ParseError(f"tracksection range: '{key}' expected a number")


@dataclass
class PathLocation:
    track: int
    offset: float
    path_offset: float


@dataclass
class PathRange:
    begin: PathLocation
    end: PathLocation


class Projection:
    def __init__(self, path):
        tracks = self._path_to_tracks(path)
        validate_path(tracks)
        self._init_tracks(tracks)

    @staticmethod
    def _path_to_tracks(path):
        tracks = []
        for route in path.payload["path"]:
            tracks += route["track_sections"]
        return tracks

    def _init_tracks(self, path):
        self.tracks = {}
        self.length = 0
        offset = 0
        for track_range in path:
            begin = track_range["begin"]
            end = track_range["end"]
            self.length += abs(end - begin)
            track_id = track_range["track_section"]
            if track_id in self.tracks:
                (p_begin, _, p_offset) = self.tracks[track_id]
                self.tracks[track_id] = (p_begin, end, p_offset)
                offset += abs(end - begin)
                continue
            self.tracks[track_id] = (begin, end, offset)
            offset += abs(end - begin)

    def track_position(self, track_id, pos):
        """
        Returns the position projected in the path.
        If the tracksection position isn't contained in the path then return `None`.
        """
        if track_id not in self.tracks:
            return None

        (begin, end, offset) = self.tracks[track_id]
        if (pos < begin and pos < end) or (pos > begin and pos > end):
            return None

        return abs(pos - begin) + offset

    def intersections(self, path):
        """
        Intersect a given path to the projected path and return a list of PathRange
        """
        intersections = []
        range_begin = None
        path_offset = 0
        next_path_offset = 0
        tracks = self._path_to_tracks(path)
        for index, track_range in enumerate(tracks):
            track_id = track_range["track_section"]
            a_begin = track_range["begin"]
            a_end = track_range["end"]
            a_length = abs(a_begin - a_end)
            path_offset = next_path_offset
            next_path_offset += a_length

            # Check if there is no intersections
            if track_id not in self.tracks:
                continue
            b_begin = min(self.tracks[track_id][0], self.tracks[track_id][1])
            b_end = max(self.tracks[track_id][0], self.tracks[track_id][1])
            if min(a_begin, a_end) >= b_end:
                continue

            # New intersection, creation of the begin location
            if range_begin is None:
                range_begin = PathLocation(track_id, a_begin, path_offset)
                if a_begin < b_begin:
                    range_begin.offset = b_begin
                    range_begin.path_offset += b_begin - a_begin
                elif a_begin > b_end:
                    range_begin.offset = b_end
                    range_begin.path_offset += a_begin - b_end

            # Check end of intersection, if so we add it to the list
            if (
                index + 1 >= len(tracks)
                or tracks[index + 1]["track_section"] not in self.tracks
            ):
                range_end = PathLocation(track_id, a_end, next_path_offset)
                if a_end < b_begin:
                    range_end.offset = b_begin
                    range_end.path_offset -= b_begin - a_end
                elif a_end > b_end:
                    range_end.offset = b_end
                    range_end.path_offset -= b_end - a_end
                intersections.append(PathRange(range_begin, range_end))
                range_begin = None
        return intersections

    def end(self):
        """
        Returns length of the path
        """
        return self.length
