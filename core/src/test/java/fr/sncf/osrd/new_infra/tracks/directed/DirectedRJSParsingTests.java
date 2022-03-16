package fr.sncf.osrd.new_infra.tracks.directed;

import static fr.sncf.osrd.new_infra.InfraHelpers.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.common.collect.Lists;
import com.google.common.collect.Sets;
import com.google.common.graph.NetworkBuilder;
import com.google.common.graph.Traverser;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.undirected.*;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.DiTrackEdgeImpl;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.DirectedInfraBuilder;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.new_infra.implementation.tracks.undirected.*;
import fr.sncf.osrd.utils.DoubleRangeMap;
import org.junit.jupiter.api.Test;
import java.util.Set;
import java.util.*;

public class DirectedRJSParsingTests {

    @Test
    public void testTinyInfra() throws Exception {
        // This test only checks that no assertion is thrown
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = UndirectedInfraBuilder.parseInfra(rjsInfra);
        DirectedInfraBuilder.fromUndirected(infra);
    }

    @Test
    public void testCustom() {
        /*
              Out1
               ^
               |
              In1
              /  ^
             /    \
            v      \
           In2     In3
            |       |
            v       v
            3       3

         */

        // Build the undirected graph
        var infra = makeSwitchInfra();
        var directedInfra = DirectedInfraBuilder.fromUndirected(infra);
        var graph = directedInfra.getDiTrackGraph();

        // Tests that we can reach exactly the right endpoints
        final var endpoint_1_in = graph.incidentNodes(directedInfra.getEdge("1", Direction.BACKWARD)).nodeU();
        final var endpoint_1_out = graph.incidentNodes(directedInfra.getEdge("1", Direction.FORWARD)).nodeU();
        final var endpoint_2_in = graph.incidentNodes(directedInfra.getEdge("2", Direction.BACKWARD)).nodeU();
        final var endpoint_2_out = graph.incidentNodes(directedInfra.getEdge("2", Direction.FORWARD)).nodeU();
        final var endpoint_3_in = graph.incidentNodes(directedInfra.getEdge("3", Direction.BACKWARD)).nodeU();
        final var endpoint_3_out = graph.incidentNodes(directedInfra.getEdge("3", Direction.FORWARD)).nodeU();
        final var allTrackEnds = Set.of(
                endpoint_1_in,
                endpoint_1_out,
                endpoint_2_in,
                endpoint_2_out,
                endpoint_3_in,
                endpoint_3_out
        );
        final var reachableFrom1 = Set.of(
                endpoint_1_in,
                endpoint_2_out,
                endpoint_3_out
        );
        final var reachableFrom2 = Set.of(
                endpoint_2_in,
                endpoint_1_out
        );
        final var reachableFrom3 = Set.of(
                endpoint_3_in,
                endpoint_1_out
        );

        final var traverser = Traverser.forGraph(graph);
        assertSetMatch(
                traverser.breadthFirst(endpoint_1_in),
                reachableFrom1,
                Sets.difference(allTrackEnds, reachableFrom1)
        );
        assertSetMatch(
                traverser.breadthFirst(endpoint_2_in),
                reachableFrom2,
                Sets.difference(allTrackEnds, reachableFrom2)
        );
        assertSetMatch(
                traverser.breadthFirst(endpoint_3_in),
                reachableFrom3,
                Sets.difference(allTrackEnds, reachableFrom3)
        );
    }

    @Test
    public void testTrackObjects() {
        // Build the undirected graph
        var builder = NetworkBuilder
                .directed()
                .<TrackNode, TrackEdge>immutable();

        final var node1 = new SwitchPortImpl("1");
        final var node2 = new SwitchPortImpl("2");
        final var node3 = new SwitchPortImpl("3");
        builder.addNode(node1);
        builder.addNode(node2);
        builder.addNode(node3);
        var edge12 = new TrackSectionImpl(100, "1-2");
        var edge32 = new TrackSectionImpl(100, "3-2");
        builder.addEdge(node1, node2, edge12);
        builder.addEdge(node3, node2, edge32);
        var detector1 = new TrackObjectImpl(edge12, 30, TrackObject.TrackObjectType.DETECTOR, "d1");
        var detector2 = new TrackObjectImpl(edge12, 60, TrackObject.TrackObjectType.DETECTOR, "d2");
        var bs1 = new TrackObjectImpl(edge12, 0, TrackObject.TrackObjectType.BUFFER_STOP, "bs1");
        var detector3 = new TrackObjectImpl(edge32, 65, TrackObject.TrackObjectType.DETECTOR, "d3");
        var detector4 = new TrackObjectImpl(edge32, 35, TrackObject.TrackObjectType.DETECTOR, "d4");
        setTrackObjects(edge12, List.of(
                detector1,
                detector2,
                bs1
        ));
        setTrackObjects(edge32, List.of(
                detector3,
                detector4
        ));

        // Converts to directed graph
        var infra = TrackInfraImpl.from(null, builder.build());
        var directedInfra = DirectedInfraBuilder.fromUndirected(infra);

        // Tests that we see the waypoints in the right order when going from 1 to 3
        final var edge1 = directedInfra.getEdge("1-2", Direction.FORWARD);
        final var edge2 = directedInfra.getEdge("3-2", Direction.BACKWARD);
        final var edge1View = new TrackRangeView(0, edge1.getEdge().getLength(), edge1);
        final var edge2View = new TrackRangeView(0, edge1.getEdge().getLength(), edge2);
        var allObjects = new ArrayList<TrackObject>();
        for (var object : edge1View.getObjects())
            allObjects.add(object.element());
        for (var object : edge2View.getObjects())
            allObjects.add(object.element());
        assertEquals(List.of(
                bs1,
                detector1,
                detector2,
                detector3,
                detector4
        ), allObjects);
    }

    @Test
    public void trackViewObjectsTest() {
        var edge1 = new TrackSectionImpl(100, "1");
        var edge2 = new TrackSectionImpl(100, "2");
        var detector1 = new TrackObjectImpl(edge1, 30, TrackObject.TrackObjectType.DETECTOR, "d1-30");
        var detector2 = new TrackObjectImpl(edge1, 60, TrackObject.TrackObjectType.DETECTOR, "d1-60");
        var detector3 = new TrackObjectImpl(edge2, 65, TrackObject.TrackObjectType.DETECTOR, "d2-65");
        var detector4 = new TrackObjectImpl(edge2, 35, TrackObject.TrackObjectType.DETECTOR, "d2-35");
        setTrackObjects(edge1, List.of(
                detector1,
                detector2
        ));
        setTrackObjects(edge2, List.of(
                detector3,
                detector4
        ));
        var diEdge1F = new DiTrackEdgeImpl(edge1, Direction.FORWARD);
        var diEdge1B = new DiTrackEdgeImpl(edge1, Direction.BACKWARD);
        var diEdge2F = new DiTrackEdgeImpl(edge2, Direction.FORWARD);
        var diEdge2B = new DiTrackEdgeImpl(edge2, Direction.BACKWARD);

        var path1 = List.of(
                new TrackRangeView(0, 100, diEdge1F),
                new TrackRangeView(0, 100, diEdge2F)
        );
        var path2 = List.of(
                new TrackRangeView(0, 50, diEdge1F),
                new TrackRangeView(50, 100, diEdge1F),
                new TrackRangeView(0, 15, diEdge2F),
                new TrackRangeView(15, 100, diEdge2F)
        );
        assertEquals(
                getObjectsOnRanges(path1),
                getObjectsOnRanges(path2)
        );

        var path3 = List.of(
                new TrackRangeView(0, 100, diEdge1B),
                new TrackRangeView(100, 0, diEdge2B)
        );
        var path4 = List.of(
                new TrackRangeView(50, 100, diEdge1B),
                new TrackRangeView(50, 0, diEdge1B),
                new TrackRangeView(15, 100, diEdge2B),
                new TrackRangeView(15, 0, diEdge2B)
        );
        assertEquals(
                getObjectsOnRanges(path3),
                getObjectsOnRanges(path4)
        );

        var path5 = List.of(
                new TrackRangeView(100, 0, diEdge2B),
                new TrackRangeView(0, 100, diEdge1B)
        );

        var objectsForward = getObjectsOnRanges(path1).stream()
                .map(x -> x.object.getID())
                .toList();

        var objectsBackward = getObjectsOnRanges(path5).stream()
                .map(x -> x.object.getID())
                .toList();
        assertEquals(objectsForward, Lists.reverse(objectsBackward));
    }


    @Test
    public void trackViewRangesTest() {
        final var edge = new TrackSectionImpl(100, "edge");
        var speedSections = new EnumMap<Direction, DoubleRangeMap>(Direction.class);
        var map = new DoubleRangeMap();
        map.addRange(0, 100, 0);
        map.addRange(0, 30, 30);
        map.addRange(60, 80, -10);
        for (var dir : Direction.values())
            speedSections.put(dir, map);
        setTrackSpeedSections(edge, speedSections);

        var edgeF = new DiTrackEdgeImpl(edge, Direction.FORWARD);
        var edgeB = new DiTrackEdgeImpl(edge, Direction.BACKWARD);
        var path1 = List.of(
                new TrackRangeView(0, 100, edgeF)
        );
        var path2 = List.of(
                new TrackRangeView(0, 15, edgeF),
                new TrackRangeView(15, 50, edgeF),
                new TrackRangeView(50, 90, edgeF),
                new TrackRangeView(90, 100, edgeF)
        );
        assertEquals(
                getSpeedsOnRange(path1),
                getSpeedsOnRange(path2)
        );

        var path3 = List.of(
                new TrackRangeView(0, 100, edgeB)
        );
        var path4 = List.of(
                new TrackRangeView(90, 100, edgeB),
                new TrackRangeView(50, 90, edgeB),
                new TrackRangeView(15, 50, edgeB),
                new TrackRangeView(0, 15, edgeB)
        );
        assertEquals(
                getSpeedsOnRange(path3),
                getSpeedsOnRange(path4)
        );

        var inverted = new DoubleRangeMap();
        inverted.addRange(0, 100, 0);
        inverted.addRange(70, 100, 30);
        inverted.addRange(20, 40, -10);
        assertEquals(
                inverted,
                getSpeedsOnRange(path3)
        );
    }

    private record Pair(TrackObject object, double position) {}

    /** Merges all the objects and positions on a list of ranges */
    private static List<Pair> getObjectsOnRanges(List<TrackRangeView> ranges) {
        var pos = 0;
        var res = new ArrayList<Pair>();
        for (var range : ranges) {
            var objects = range.getObjects();
            for (var obj : objects)
                res.add(new Pair(obj.element(), pos + obj.offset()));
            pos += range.getLength();
        }
        return res;
    }

    /** Merges all the speed sections on a list of ranges */
    private static DoubleRangeMap getSpeedsOnRange(List<TrackRangeView> ranges) {
        var pos = 0;
        var res = new DoubleRangeMap();
        for (var range : ranges) {
            var sections = range.getSpeedSections();
            for (var section : sections.getValuesInRange(0, range.getLength()).entrySet())
                res.addRange(
                        section.getKey().getBeginPosition() + pos,
                        section.getKey().getEndPosition() + pos,
                        section.getValue()
                );
            pos += range.getLength();
        }
        return res.simplify();
    }
}
