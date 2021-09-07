from rest_framework.exceptions import ParseError


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

    def end(self):
        """
        Returns length of the path
        """
        return self.length
