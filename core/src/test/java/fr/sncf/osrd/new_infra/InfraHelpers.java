package fr.sncf.osrd.new_infra;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.graph.ImmutableNetwork;
import com.google.common.graph.Network;
import com.google.common.graph.NetworkBuilder;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackEdge;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackEdge;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackInfra;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackNode;
import fr.sncf.osrd.new_infra.implementation.tracks.undirected.InfraTrackSection;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

public class InfraHelpers {

    /** Returns the InfraTrackSection with the given ID, throws if it can't be found */
    public static InfraTrackSection getTrack(TrackInfra infra, String id) {
        return infra
                .getTrackGraph()
                .edges()
                .stream()
                .filter(edge -> edge instanceof InfraTrackSection)
                .map(edge -> (InfraTrackSection) edge)
                .filter(edge -> edge.id.equals(id))
                .findFirst()
                .orElseThrow();
    }

    /** Returns the DiTrackEdge matching the InfraTrackSection with the given ID, throws if it can't be found.
     * Returns the edge going the same way as the TrackInfra if dir == Forward, otherwise the opposite. */
    public static DiTrackEdge getDiTrack(DiTrackInfra infra, String id, Direction dir) {
        return infra
                .getDiTrackGraph()
                .edges()
                .stream()
                .filter(edge -> edge.edge() instanceof InfraTrackSection)
                .filter(edge -> ((InfraTrackSection) edge.edge()).id.equals(id))
                .filter(edge -> edge.direction().equals(dir))
                .findFirst()
                .orElseThrow();
    }

    /** Returns the same graph as g, but undirected */
    public static Network<TrackNode, TrackEdge> toUndirected(Network<TrackNode, TrackEdge> g) {
        ImmutableNetwork.Builder<TrackNode, TrackEdge> builder = NetworkBuilder
                .undirected()
                .immutable();
        for (var n : g.nodes())
            builder.addNode(n);
        for (var e : g.edges())
            builder.addEdge(g.incidentNodes(e), e);
        return builder.build();
    }

    /** Asserts that `values` contains every element from `included` and none from `excluded`.
     * Values that don't appear in either of those are ignored. */
    public static <T> void assertSetMatch(Iterable<T> values, Set<T> included, Set<T> excluded) {
        var valuesSet = StreamSupport.stream(values.spliterator(), false).collect(Collectors.toSet());
        for (var x : included)
            assertTrue(valuesSet.contains(x));
        for (var x : excluded)
            assertFalse(valuesSet.contains(x));
    }
}
