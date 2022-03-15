package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import static fr.sncf.osrd.new_infra.api.tracks.undirected.TrackEdge.INDEX;

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
        setIndexToEdges(trackGraph);
    }

    /** Sets the attribute INDEX to each edge, from 0 to n_edges. Used later on for union finds */
    private static void setIndexToEdges(ImmutableNetwork<TrackNode, TrackEdge> trackGraph) {
        var trackID = 0;
        for (var edge : trackGraph.edges())
            edge.getAttrs().putAttr(INDEX, trackID++);
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
