package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import com.google.common.collect.ImmutableMap;
import com.google.common.graph.ImmutableNetwork;
import fr.sncf.osrd.new_infra.api.tracks.undirected.*;
import java.util.HashMap;
import java.util.Map;

public class TrackInfraImpl implements TrackInfra {
    private final ImmutableMap<String, Switch> switches;
    private final ImmutableNetwork<TrackNode, TrackEdge> trackGraph;
    private final Map<String, TrackSection> trackSections;
    private final ImmutableMap<String, Detector> detectorMap;

    /** Constructor */
    public TrackInfraImpl(
            ImmutableMap<String, Switch> switches,
            ImmutableNetwork<TrackNode, TrackEdge> trackGraph,
            Map<String, TrackSection> trackSections,
            ImmutableMap<String, Detector> detectorMap
    ) {
        this.switches = switches;
        this.trackGraph = trackGraph;
        this.trackSections = trackSections;
        this.detectorMap = detectorMap;
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
        return new TrackInfraImpl(switches, trackGraph, makeTrackSections(trackGraph), makeDetectorMap(trackGraph));
    }

    private static ImmutableMap<String, Detector> makeDetectorMap(
            ImmutableNetwork<TrackNode, TrackEdge> trackGraph
    ) {
        var res = ImmutableMap.<String, Detector>builder();
        for (var track : trackGraph.edges()) {
            for (var detector : track.getDetectors())
                res.put(detector.getID(), detector);
        }
        return res.build();
    }

    /** Sets the index to each edge, from 0 to n_edges. Used later on for union finds */
    private static void setIndexToEdges(ImmutableNetwork<TrackNode, TrackEdge> trackGraph) {
        var trackID = 0;
        for (var edge : trackGraph.edges()) {
            if (edge instanceof SwitchBranchImpl branch)
                branch.index = trackID++;
            else if (edge instanceof TrackSectionImpl track)
                track.index = trackID++;
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

    @Override
    public ImmutableMap<String, Detector> getDetectorMap() {
        return detectorMap;
    }
}
