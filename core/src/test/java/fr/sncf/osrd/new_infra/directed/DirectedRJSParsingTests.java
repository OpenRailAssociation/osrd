package fr.sncf.osrd.new_infra.directed;

import static fr.sncf.osrd.new_infra.InfraHelpers.*;

import com.google.common.collect.Sets;
import com.google.common.graph.NetworkBuilder;
import com.google.common.graph.Traverser;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.tracks.undirected.*;
import fr.sncf.osrd.new_infra.implementation.tracks.undirected.*;
import org.junit.jupiter.api.Test;
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
        var builder = NetworkBuilder
                .directed()
                .<TrackNode, TrackEdge>immutable();

        final var nodeIn1 = new InfraSwitchPort("1");
        final var nodeIn2 = new InfraSwitchPort("2");
        final var nodeIn3 = new InfraSwitchPort("3");
        final var nodeOut1 = new InfraTrackNode.Joint();
        final var nodeOut2 = new InfraTrackNode.Joint();
        final var nodeOut3 = new InfraTrackNode.Joint();
        builder.addNode(nodeIn1);
        builder.addNode(nodeIn2);
        builder.addNode(nodeIn3);
        builder.addNode(nodeOut1);
        builder.addNode(nodeOut2);
        builder.addNode(nodeOut3);
        builder.addEdge(nodeIn1, nodeOut1, new InfraTrackSection(0, "1"));
        builder.addEdge(nodeIn2, nodeOut2, new InfraTrackSection(0, "2"));
        builder.addEdge(nodeIn3, nodeOut3, new InfraTrackSection(0, "3"));
        builder.addEdge(nodeIn1, nodeIn2, new InfraSwitchBranch(0));
        builder.addEdge(nodeIn3, nodeIn1, new InfraSwitchBranch(0));

        // Converts to directed graph
        var infra = new InfraTrackInfra(null, builder.build());
        var directedInfra = fr.sncf.osrd.new_infra.implementation.tracks.directed.Parser.fromUndirected(infra);
        var graph = directedInfra.getDiTrackGraph();

        // Tests that we can reach exactly the right endpoints
        final var endpoint_1_in = graph.incidentNodes(getDiTrack(directedInfra,
                "1", Direction.BACKWARD)).nodeU();
        final var endpoint_1_out = graph.incidentNodes(getDiTrack(directedInfra,
                "1", Direction.FORWARD)).nodeU();
        final var endpoint_2_in = graph.incidentNodes(getDiTrack(directedInfra,
                "2", Direction.BACKWARD)).nodeU();
        final var endpoint_2_out = graph.incidentNodes(getDiTrack(directedInfra,
                "2", Direction.FORWARD)).nodeU();
        final var endpoint_3_in = graph.incidentNodes(getDiTrack(directedInfra,
                "3", Direction.BACKWARD)).nodeU();
        final var endpoint_3_out = graph.incidentNodes(getDiTrack(directedInfra,
                "3", Direction.FORWARD)).nodeU();
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
}
