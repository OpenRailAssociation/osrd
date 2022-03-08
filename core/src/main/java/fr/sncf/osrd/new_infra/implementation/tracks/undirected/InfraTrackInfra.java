package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import com.google.common.collect.ImmutableMap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.tracks.undirected.Switch;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackEdge;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackInfra;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackNode;

public class InfraTrackInfra implements TrackInfra {
    private final ImmutableMap<String, Switch> switches;
    private final ImmutableNetwork<TrackNode, TrackEdge> trackGraph;

    public InfraTrackInfra(ImmutableMap<String, Switch> switches, ImmutableNetwork<TrackNode, TrackEdge> trackGraph) {
        this.switches = switches;
        this.trackGraph = trackGraph;
    }

    @Override
    public ImmutableNetwork<TrackNode, TrackEdge> getTrackGraph() {
        return trackGraph;
    }

    @Override
    public ImmutableMap<String, Switch> getSwitches() {
        return switches;
    }
}
