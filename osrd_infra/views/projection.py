from rest_framework.exceptions import ParseError
from osrd_infra.models import (
    SignalEntity,
    entities_prefetch_components,
)


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


class Projection:
    def __init__(self, path):
        validate_path(path)
        self._init_tracks(path)
        self._init_signals()

    def _init_tracks(self, path):
        self.tracks = {}
        self.length = 0
        offset = 0
        for track_range in path:
            begin = track_range["begin"]
            end = track_range["end"]
            track_id = track_range["track_section"]
            if track_id in self.tracks:
                (p_begin, _, p_offset) = self.tracks[track_id]
                self.tracks[track_id] = (p_begin, end, p_offset)
                continue
            self.tracks[track_id] = (begin, end, offset)
            offset += abs(end - begin)
            self.length += abs(end - begin)

    def _init_signals(self):
        self.signals = {}
        track_section_ids = [track for track in self.tracks]
        qs = SignalEntity.objects.filter(
            point_location__track_section__in=track_section_ids
        )
        signals = entities_prefetch_components(SignalEntity, qs)
        for signal in signals:
            location = signal.point_location
            track = location.track_section
            pos = location.offset
            if track.entity_id not in self.tracks:
                continue

            (begin, end, offset) = self.tracks[track.entity_id]
            if (pos < begin and pos < end) or (pos > begin and pos > end):
                continue
            self.signals[signal.entity_id] = offset + abs(pos - begin)

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

    def signal(self, signal):
        """
        Returns the position of a signal projected in the path.
        If the signal position isn't contained in the path then return `None`.
        """
        if signal.entity_id not in self.signals:
            return None
        return self.signals[signal.entity_id]

    def end(self):
        """
        Returns length of the path
        """
        return self.length
