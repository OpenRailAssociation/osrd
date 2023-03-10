from dataclasses import dataclass
from typing import List

from osrd_schemas.path import DirectionalTrackRange, PathPayload


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
    __slots__ = "tracks", "length"

    def __init__(self, path_payload: PathPayload):
        dir_track_ranges = self._path_to_tracks(path_payload)
        self._init_tracks(dir_track_ranges)

    @staticmethod
    def _path_to_tracks(path_payload: PathPayload):
        tracks = []
        for route_path in path_payload.route_paths:
            tracks += [track for track in route_path.track_sections if track.begin != track.end]
        return Projection._merge_ranges_same_tracks(tracks)

    @staticmethod
    def _merge_ranges_same_tracks(ranges: List[DirectionalTrackRange]) -> List[DirectionalTrackRange]:
        res: List[DirectionalTrackRange] = ranges[:1]
        for r in ranges[1:]:
            if res[-1].track != r.track:
                res.append(r)
                continue
            assert res[-1].direction == r.direction
            assert res[-1].begin == r.end or res[-1].end == r.begin
            res[-1] = DirectionalTrackRange(
                track=r.track,
                direction=r.direction,
                begin=min(res[-1].begin, r.begin),
                end=max(res[-1].end, r.end),
            )
        return res

    def _init_tracks(self, dir_track_ranges: List[DirectionalTrackRange]):
        self.tracks = {}
        self.length = 0
        offset = 0
        for dir_track_range in dir_track_ranges:
            begin = dir_track_range.get_begin()
            end = dir_track_range.get_end()
            self.length += abs(end - begin)
            track_id = dir_track_range.track
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
            if abs(pos - begin) < 1e-8:
                return offset
            if abs(pos - end) < 1e-8:
                return offset + abs(end - begin)
            return None

        return abs(pos - begin) + offset

    def intersections(self, path_payload: PathPayload) -> List[PathRange]:
        """
        Intersect a given path to the projected path and return a list of PathRange
        """
        intersections = []
        range_begin = None
        path_offset = 0
        next_path_offset = 0
        dir_track_ranges = self._path_to_tracks(path_payload)
        for index, dir_track_range in enumerate(dir_track_ranges):
            track_id = dir_track_range.track
            a_begin = dir_track_range.begin
            a_end = dir_track_range.end
            a_length = abs(a_begin - a_end)
            path_offset = next_path_offset
            next_path_offset += a_length

            # Check if there is no intersections
            if track_id not in self.tracks:
                assert range_begin is None
                continue
            b_begin = min(self.tracks[track_id][0], self.tracks[track_id][1])
            b_end = max(self.tracks[track_id][0], self.tracks[track_id][1])
            if min(a_begin, a_end) >= b_end or max(a_begin, a_end) <= b_begin:
                assert range_begin is None
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
            if index + 1 >= len(dir_track_ranges) or dir_track_ranges[index + 1].track not in self.tracks:
                range_end = PathLocation(track_id, a_end, next_path_offset)
                if a_end < b_begin:
                    range_end.offset = b_begin
                    range_end.path_offset -= b_begin - a_end
                elif a_end > b_end:
                    range_end.offset = b_end
                    range_end.path_offset -= a_end - b_end
                intersections.append(PathRange(range_begin, range_end))
                range_begin = None
        return intersections

    def end(self):
        """
        Returns length of the path
        """
        return self.length
