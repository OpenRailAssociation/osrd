package fr.sncf.osrd.new_infra.api.tracks.directed;

import com.google.common.graph.ImmutableNetwork;

public interface DiTrackInfra {
    /** Returns the directed track graph */
    ImmutableNetwork<DiTrackNode, DiTrackEdge> getDiTrackGraph();
}
