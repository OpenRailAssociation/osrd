package fr.sncf.osrd.new_infra.undirected;

import com.google.common.graph.Traverser;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackInfra;
import fr.sncf.osrd.new_infra.implementation.tracks.undirected.InfraTrackSection;
import fr.sncf.osrd.new_infra.implementation.tracks.undirected.Parser;
import org.junit.jupiter.api.Test;
import java.util.stream.StreamSupport;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class RJSParsingTests {

    private static InfraTrackSection getTrack(TrackInfra infra, String id) {
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

    private static <T> boolean contains(Iterable<T> it, T element) {
        return StreamSupport.stream(it.spliterator(), false)
                .anyMatch(x -> x.equals(element));
    }

    @Test
    public void testTinyInfra() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = Parser.parseInfra(rjsInfra);
        var graph = infra.getTrackGraph();
        var traverser = Traverser.forGraph(graph);
        var foo_a_endpoint = graph.incidentNodes(getTrack(infra, "ne.micro.foo_a")).nodeU();
        var foo_b_endpoint = graph.incidentNodes(getTrack(infra, "ne.micro.foo_b")).nodeU();
        var bar_a_endpoint = graph.incidentNodes(getTrack(infra, "ne.micro.bar_a")).nodeU();

        // Everything should be connected (undirected graph)
        assertTrue(contains(traverser.breadthFirst(foo_a_endpoint), bar_a_endpoint));
        assertTrue(contains(traverser.breadthFirst(bar_a_endpoint), foo_b_endpoint));
        assertTrue(contains(traverser.breadthFirst(foo_b_endpoint), foo_a_endpoint));
    }
}
