package fr.sncf.osrd.new_infra.tracks.undirected;

import static com.google.common.collect.Iterables.contains;
import static fr.sncf.osrd.new_infra.InfraHelpers.*;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.graph.Traverser;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.new_infra.implementation.tracks.undirected.UndirectedInfraBuilder;
import org.junit.jupiter.api.Test;

public class RJSParsingTests {

    @Test
    public void testTinyInfra() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = UndirectedInfraBuilder.parseInfra(rjsInfra);
        var graph = toUndirected(infra.getTrackGraph());
        var traverser = Traverser.forGraph(graph);
        var fooAEndpoint = graph.incidentNodes(getTrack(infra, "ne.micro.foo_a")).nodeU();
        var fooBEndpoint = graph.incidentNodes(getTrack(infra, "ne.micro.foo_b")).nodeU();
        var barAEndpoint = graph.incidentNodes(getTrack(infra, "ne.micro.bar_a")).nodeU();

        // Everything should be connected (undirected graph)
        assertTrue(contains(traverser.breadthFirst(fooAEndpoint), barAEndpoint));
        assertTrue(contains(traverser.breadthFirst(barAEndpoint), fooBEndpoint));
        assertTrue(contains(traverser.breadthFirst(fooBEndpoint), fooAEndpoint));
    }
}
