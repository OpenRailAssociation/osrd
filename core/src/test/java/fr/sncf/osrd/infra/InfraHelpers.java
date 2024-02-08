package fr.sncf.osrd.infra;

import static fr.sncf.osrd.infra.api.Direction.BACKWARD;
import static fr.sncf.osrd.infra.api.Direction.FORWARD;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.collect.*;
import com.google.common.graph.*;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.undirected.*;
import fr.sncf.osrd.infra.implementation.tracks.undirected.*;
import java.util.EnumMap;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

public class InfraHelpers {

    /** Returns the InfraTrackSection with the given ID, throws if it can't be found */
    public static TrackSection getTrack(TrackInfra infra, String id) {
        return infra.getTrackSection(id);
    }

    /** Returns the same graph as g, but undirected */
    public static Network<TrackNode, TrackEdge> toUndirected(Network<TrackNode, TrackEdge> g) {
        ImmutableNetwork.Builder<TrackNode, TrackEdge> builder =
                NetworkBuilder.undirected().immutable();
        for (var n : g.nodes()) builder.addNode(n);
        for (var e : g.edges()) {
            var pair = g.incidentNodes(e);
            builder.addEdge(EndpointPair.unordered(pair.nodeU(), pair.nodeV()), e);
        }
        return builder.build();
    }

    /**
     * Asserts that `values` contains every element from `included` and none from `excluded`. Values
     * that don't appear in either of those are ignored.
     */
    public static <T> void assertSetMatch(Iterable<T> values, Set<T> included, Set<T> excluded) {
        var valuesSet = StreamSupport.stream(values.spliterator(), false).collect(Collectors.toSet());
        for (var x : included) assertTrue(valuesSet.contains(x));
        for (var x : excluded) assertFalse(valuesSet.contains(x));
    }

    /**
     * Make a switch infra with the following configuration: Out1 ^ | In1 / ^ / \ v \ In2 In3 | | v
     * v 3 3
     */
    public static TrackInfra makeSwitchInfra() {
        final var nodeIn1 = new SwitchPortImpl("1", "switchID");
        final var nodeIn2 = new SwitchPortImpl("2", "switchID");
        final var nodeIn3 = new SwitchPortImpl("3", "switchID");
        final var branch12 = new SwitchBranchImpl("1", "2");
        final var branch31 = new SwitchBranchImpl("3", "1");
        final var nodeOut1 = new TrackNodeImpl.Joint("1-out");
        final var nodeOut2 = new TrackNodeImpl.Joint("2-out");
        final var nodeOut3 = new TrackNodeImpl.Joint("3-out");

        final var switchNet = NetworkBuilder.directed().<SwitchPort, SwitchBranch>immutable();
        switchNet.addEdge(nodeIn1, nodeIn2, branch12);
        switchNet.addEdge(nodeIn3, nodeIn1, branch31);
        final var switchGroups = ImmutableMultimap.<String, SwitchBranch>builder();
        switchGroups.put("left", branch12);
        switchGroups.put("right", branch31);
        final var ports = ImmutableMap.<String, SwitchPort>builder();
        ports.put(nodeIn1.getID(), nodeIn1);
        ports.put(nodeIn2.getID(), nodeIn2);
        ports.put(nodeIn3.getID(), nodeIn3);
        final var switchA = new SwitchImpl("a", switchNet.build(), switchGroups.build(), 42, ports.build());

        var trackNet = NetworkBuilder.directed().<TrackNode, TrackEdge>immutable();
        trackNet.addEdge(nodeIn1, nodeOut1, new TrackSectionImpl(0, "1"));
        trackNet.addEdge(nodeIn2, nodeOut2, new TrackSectionImpl(0, "2"));
        trackNet.addEdge(nodeIn3, nodeOut3, new TrackSectionImpl(0, "3"));
        trackNet.addEdge(nodeIn1, nodeIn2, branch12);
        trackNet.addEdge(nodeIn3, nodeIn1, branch31);

        var switches = ImmutableMap.<String, Switch>of(switchA.getID(), switchA);
        return TrackInfraImpl.from(switches, trackNet.build());
    }

    /** Get the value in the map, throw if absent */
    public static <T, U> T safeGet(ImmutableMap<U, T> m, U x) {
        var res = m.get(x);
        if (res == null) throw new RuntimeException("Unexpected null value");
        return res;
    }

    private static DiDetector getDetector(ImmutableMap<String, Detector> detectors, Direction dir, String id) {
        return safeGet(detectors, id).getDiDetector(dir);
    }

    /**
     * Tests that the right DiDetectors can be reached in an oriented graph based on tiny infra. Can
     * be used for different route types
     */
    public static <T> void testTinyInfraDiDetectorGraph(
            ImmutableNetwork<DiDetector, T> graph, ImmutableMap<String, Detector> detectors) {
        var bufferStopA = getDetector(detectors, FORWARD, "buffer_stop_a");
        var bufferStopB = getDetector(detectors, FORWARD, "buffer_stop_b");
        var bufferStopC = getDetector(detectors, FORWARD, "buffer_stop_c");
        var bufferStopABackward = getDetector(detectors, BACKWARD, "buffer_stop_a");
        var bufferStopBBackward = getDetector(detectors, BACKWARD, "buffer_stop_b");
        var bufferStopCBackward = getDetector(detectors, BACKWARD, "buffer_stop_c");
        var allDirectedBufferStops = Set.of(
                bufferStopA, bufferStopB, bufferStopC, bufferStopABackward, bufferStopBBackward, bufferStopCBackward);
        var reachableFromA = Set.of(bufferStopA, bufferStopC);
        var reachableFromB = Set.of(bufferStopB, bufferStopC);
        var reachableFromC = Set.of(bufferStopABackward, bufferStopBBackward, bufferStopCBackward);
        final var traverser = Traverser.forGraph(graph);
        assertSetMatch(
                traverser.breadthFirst(bufferStopA),
                reachableFromA,
                Sets.difference(allDirectedBufferStops, reachableFromA));
        assertSetMatch(
                traverser.breadthFirst(bufferStopB),
                reachableFromB,
                Sets.difference(allDirectedBufferStops, reachableFromB));
        assertSetMatch(
                traverser.breadthFirst(bufferStopCBackward),
                reachableFromC,
                Sets.difference(allDirectedBufferStops, reachableFromC));
    }

    /** Sets the detectors on the track, bypassing visibility */
    public static void setDetectors(TrackSection track, List<Detector> detectors) {
        setPrivateField(track, "detectors", ImmutableList.copyOf(detectors));
    }

    /** Sets the speed sections on the track, bypassing visibility */
    public static void setTrackSpeedSections(
            TrackSection track, EnumMap<Direction, RangeMap<Double, SpeedLimits>> speedSections) {
        setPrivateField(track, "speedSections", speedSections);
    }

    /** Sets the slopes on the track, bypassing visibility */
    public static void setSlopes(TrackSection track, EnumMap<Direction, RangeMap<Double, Double>> slopes) {
        setPrivateField(track, "slopes", slopes);
    }

    /** Sets a field on the track, bypassing visibility */
    @SuppressFBWarnings({"DP_DO_INSIDE_DO_PRIVILEGED", "REFLF_REFLECTION_MAY_INCREASE_ACCESSIBILITY_OF_FIELD"})
    public static <T> void setPrivateField(TrackSection track, String name, T value) {
        if (track instanceof TrackSectionImpl impl) {
            try {
                var field = TrackSectionImpl.class.getDeclaredField(name);
                field.setAccessible(true);
                field.set(impl, value);
            } catch (NoSuchFieldException | IllegalAccessException e) {
                throw new RuntimeException(e);
            }
        }
    }

    /** Returns the signaling route with the given ID. */
    public static SignalingRoute getSignalingRoute(SignalingInfra infra, String id) {
        var reservationRoute = infra.getReservationRouteMap().get(id);
        assert reservationRoute != null;
        return infra.getRouteMap().get(reservationRoute).stream().findFirst().orElseThrow();
    }
}
