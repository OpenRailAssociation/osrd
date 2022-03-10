package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import com.google.common.collect.ImmutableMap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.tracks.undirected.*;
import java.util.HashMap;
import java.util.Map;

public class InfraTrackInfra implements TrackInfra {
    private final ImmutableMap<String, Switch> switches;
    private final ImmutableNetwork<TrackNode, TrackEdge> trackGraph;
    private final Map<String, TrackSection> trackSections;

    /** Constructor */
    public InfraTrackInfra(
            ImmutableMap<String, Switch> switches,
            ImmutableNetwork<TrackNode, TrackEdge> trackGraph) {
        this.switches = switches;
        this.trackGraph = trackGraph;
        trackSections = new HashMap<>();
        for (var track : trackGraph.edges()) {
            if (track instanceof TrackSection trackSection) {
                trackSections.put(trackSection.getID(), trackSection);
            }
        }
    }

    @Override
    public ImmutableNetwork<TrackNode, TrackEdge> getTrackGraph() {
        return trackGraph;
    }

    @Override
    public ImmutableMap<String, Switch> getSwitches() {
        return switches;
    }

    @Override
    public TrackSection getTrackSection(String id) {
        return trackSections.get(id);
    }
}
