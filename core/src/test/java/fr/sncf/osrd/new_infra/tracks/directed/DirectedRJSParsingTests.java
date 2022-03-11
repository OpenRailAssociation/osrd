package fr.sncf.osrd.new_infra.tracks.directed;

import static fr.sncf.osrd.new_infra.InfraHelpers.*;
import static fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackEdge.ORIENTED_TRACK_OBJECTS;
import static fr.sncf.osrd.new_infra.api.tracks.undirected.TrackEdge.TRACK_OBJECTS;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.common.collect.Sets;
import com.google.common.graph.NetworkBuilder;
import com.google.common.graph.Traverser;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.undirected.*;
import fr.sncf.osrd.new_infra.implementation.tracks.undirected.*;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public class DirectedRJSParsingTests {

    @Test
    public void testTinyInfra() throws Exception {
        // This test only checks that no assertion is thrown
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = Parser.parseInfra(rjsInfra);
        fr.sncf.osrd.new_infra.implementation.tracks.directed.Parser.fromUndirected(infra);
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
        var directedInfra = fr.sncf.osrd.new_infra.implementation.tracks.directed.Parser.fromUndirected(infra);
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

        final var node1 = new InfraSwitchPort("1");
        final var node2 = new InfraSwitchPort("2");
        final var node3 = new InfraSwitchPort("3");
        builder.addNode(node1);
        builder.addNode(node2);
        builder.addNode(node3);
        var edge12 = new InfraTrackSection(100, "1-2");
        var edge32 = new InfraTrackSection(100, "3-2");
        builder.addEdge(node1, node2, edge12);
        builder.addEdge(node3, node2, edge32);
        var detector1 = new InfraTrackObject(edge12, 30, TrackObject.TrackObjectType.DETECTOR, "d1");
        var detector2 = new InfraTrackObject(edge12, 60, TrackObject.TrackObjectType.DETECTOR, "d2");
        var bs1 = new InfraTrackObject(edge12, 0, TrackObject.TrackObjectType.BUFFER_STOP, "bs1");
        var detector3 = new InfraTrackObject(edge32, 65, TrackObject.TrackObjectType.DETECTOR, "d3");
        var detector4 = new InfraTrackObject(edge32, 35, TrackObject.TrackObjectType.DETECTOR, "d4");
        edge12.getAttrs().putAttr(TRACK_OBJECTS, List.of(
                detector1,
                detector2,
                bs1
        ));
        edge32.getAttrs().putAttr(TRACK_OBJECTS, List.of(
                detector3,
                detector4
        ));

        // Converts to directed graph
        var infra = new InfraTrackInfra(null, builder.build());
        var directedInfra = fr.sncf.osrd.new_infra.implementation.tracks.directed.Parser.fromUndirected(infra);

        // Tests that we see the waypoints in the right order when going from 1 to 3
        final var edge1 = directedInfra.getEdge("1-2", Direction.FORWARD);
        final var edge2 = directedInfra.getEdge("3-2", Direction.BACKWARD);
        var allObjects = new ArrayList<TrackObject>();
        for (var object : edge1.getAttrs().getAttrOrThrow(ORIENTED_TRACK_OBJECTS))
            allObjects.add(object.object());
        for (var object : edge2.getAttrs().getAttrOrThrow(ORIENTED_TRACK_OBJECTS))
            allObjects.add(object.object());
        assertEquals(List.of(
                bs1,
                detector1,
                detector2,
                detector3,
                detector4
        ), allObjects);
    }
}
