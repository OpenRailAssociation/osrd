package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import static fr.sncf.osrd.new_infra.api.tracks.undirected.TrackEdge.INDEX;

import com.google.common.collect.ImmutableMap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.tracks.undirected.*;
import java.util.HashMap;
import java.util.Map;

public class TrackInfraImpl implements TrackInfra {
    private final ImmutableMap<String, Switch> switches;
    private final ImmutableNetwork<TrackNode, TrackEdge> trackGraph;
    private final Map<String, TrackSection> trackSections;

    /** Constructor */
    public TrackInfraImpl(
            ImmutableMap<String, Switch> switches,
            ImmutableNetwork<TrackNode, TrackEdge> trackGraph,
            Map<String, TrackSection> trackSections
    ) {
        this.switches = switches;
        this.trackGraph = trackGraph;
        this.trackSections = trackSections;
    }

    protected static Map<String, TrackSection> makeTrackSections(ImmutableNetwork<TrackNode, TrackEdge> trackGraph) {
        var trackSections = new HashMap<String, TrackSection>();
        for (var track : trackGraph.edges()) {
            if (track instanceof TrackSection trackSection) {
                trackSections.put(trackSection.getID(), trackSection);
            }
        }
        setIndexToEdges(trackGraph);
        return trackSections;
    }

    /** Instantiates a TrackInfra */
    public static TrackInfra from(
            ImmutableMap<String, Switch> switches,
            ImmutableNetwork<TrackNode, TrackEdge> trackGraph) {
        return new TrackInfraImpl(switches, trackGraph, makeTrackSections(trackGraph));
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
