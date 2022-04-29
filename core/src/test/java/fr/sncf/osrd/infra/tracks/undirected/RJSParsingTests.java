package fr.sncf.osrd.infra.tracks.undirected;

import static com.google.common.collect.Iterables.contains;
import static fr.sncf.osrd.infra.InfraHelpers.getTrack;
import static fr.sncf.osrd.infra.InfraHelpers.toUndirected;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.graph.Traverser;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.infra.errors.InvalidInfraError;
import fr.sncf.osrd.infra.implementation.tracks.undirected.UndirectedInfraBuilder;
import fr.sncf.osrd.railjson.schema.common.RJSObjectRef;
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackEndpoint;
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSectionLink;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;

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

    @Test
    public void testDuplicatedSwitch() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        rjsInfra.switches.add(rjsInfra.switches.iterator().next());
        assertThrows(
                InvalidInfraError.class,
                () -> UndirectedInfraBuilder.parseInfra(rjsInfra)
        );
    }

    @Test
    public void testLinkOnSwitch() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var s = rjsInfra.switches.iterator().next();
        var ports = new ArrayList<>(s.ports.values());
        rjsInfra.trackSectionLinks.add(new RJSTrackSectionLink(
                "broken",
                ApplicableDirection.BOTH,
                ports.get(0),
                new RJSTrackEndpoint(new RJSObjectRef<>("ne.micro.bar_a", "TrackSection"), EdgeEndpoint.END)
        ));
        assertThrows(
                InvalidInfraError.class,
                () -> UndirectedInfraBuilder.parseInfra(rjsInfra)
        );
    }
}
