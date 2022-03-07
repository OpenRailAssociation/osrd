package fr.sncf.osrd.new_infra.api.tracks;

import com.google.common.graph.Network;

public interface TrackInfra {
    Network<TrackNode, TrackEdge> getTrackGraph();
}
