package fr.sncf.osrd.new_infra.api.tracks.undirected;

import com.google.common.collect.ImmutableMap;
import com.google.common.graph.ImmutableNetwork;

public interface TrackInfra {
    /** Returns an undirected graph of all tracks */
    ImmutableNetwork<TrackNode, TrackEdge> getTrackGraph();

    /** Returns a map from switch to switch ID */
    ImmutableMap<String, Switch> getSwitches();

    TrackSection getTrackSection(String id);

    ImmutableMap<String, Detector> getDetectorMap();
}
