from rest_framework.exceptions import ParseError
from osrd_infra.models import TrackSectionEntity


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


class Projection:
    def __init__(self, path):
        validate_path(path)
        self.init_tracks(path)
        self.init_signals()

    def init_tracks(self, path):
        self.tracks = {}
        offset = 0
        for track_range in path:
            begin = track_range["begin"]
            end = track_range["end"]
            self.tracks.put(
                track_range["tracksection"],
                (begin, end, offset),
            )
            offset += abs(end - begin)

    def init_signals(self):
        ids = [track for track in self.tracks]
        related_names = ["point_location"]
        track_entities = TrackSectionEntity.objects.prefetch_related(
            *related_names
        ).filter(pk__in=ids)

        for entity in track_entities:
            import pdb

            pdb.set_trace()

    def track_position(self, track_position):
        """
        Returns the position projected in the path.
        If the tracksection position isn't contained in the path then return `None`.
        """
        track = track_position.track_section
        pos = track_position.offset

        if track not in self.tracks:
            return None

        (begin, end, offset) = self.tracks[track]
        if (pos < begin and pos < end) or (pos > begin and pos > end):
            return None

        return abs(pos - begin) + offset
