package fr.sncf.osrd.new_infra.implementation.tracks.directed;

import com.google.common.graph.ImmutableNetwork;
import com.google.common.graph.NetworkBuilder;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackEdge;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackNode;
import fr.sncf.osrd.new_infra.api.tracks.undirected.*;
import java.util.HashMap;

public class DiTrackInfraImpl implements fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackInfra {

    private final ImmutableNetwork<DiTrackNode, DiTrackEdge> graph;

    public DiTrackInfraImpl(ImmutableNetwork<DiTrackNode, DiTrackEdge> graph) {
        this.graph = graph;
    }

    @Override
    public ImmutableNetwork<DiTrackNode, DiTrackEdge> getDiTrackGraph() {
        return graph;
    }
}
