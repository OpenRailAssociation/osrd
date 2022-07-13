import json

from django.contrib.gis.geos import GEOSGeometry

from osrd_infra.models import Infra, SignalModel, TrackSectionModel

from .layer_creator import LayerCreator


def generate_layers(infra: Infra):
    tracks = {}
    for track in TrackSectionModel.objects.filter(infra=infra):
        tracks[track.obj_id] = track.data

    generate_track_sections(infra, tracks)
    generate_signals(infra, tracks)


def generate_track_sections(infra: Infra, tracks):
    with LayerCreator("track_sections", infra.id) as creator:
        creator.add_all(tracks.values())


def generate_signals(infra: Infra, tracks):
    with LayerCreator("signals", infra.id) as creator:
        for signal in SignalModel.objects.filter(infra=infra):
            track = tracks[signal.data["track"]["id"]]
            normalized_pos = signal.data["position"]
            geo = json.loads(GEOSGeometry(json.dumps(track["geo"])).interpolate_normalized(normalized_pos).json)
            sch = json.loads(GEOSGeometry(json.dumps(track["sch"])).interpolate_normalized(normalized_pos).json)
            signal_data = {"geo": geo, "sch": sch, **signal.data}
            creator.add(signal_data)
