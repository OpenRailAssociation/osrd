package fr.sncf.osrd.new_infra.tracks.directed;

import static fr.sncf.osrd.new_infra.InfraHelpers.*;

import com.google.common.collect.Sets;
import com.google.common.graph.Traverser;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.DirectedInfraBuilder;
import fr.sncf.osrd.new_infra.implementation.tracks.undirected.*;
import org.junit.jupiter.api.Test;
import java.util.Set;

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
}
