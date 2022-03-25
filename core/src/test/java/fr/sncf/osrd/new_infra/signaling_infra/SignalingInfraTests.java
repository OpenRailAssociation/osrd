package fr.sncf.osrd.new_infra.signaling_infra;

import static fr.sncf.osrd.new_infra.InfraHelpers.testTinyInfraDiDetectorGraph;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.new_infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.new_infra.implementation.signaling.SignalingInfraBuilder;
import org.junit.jupiter.api.Test;
import java.util.HashSet;
import java.util.Set;

public class SignalingInfraTests {
    @Test
    public void testTinyInfra() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var graph = infra.getSignalingRouteGraph();
        assertEquals(graph.nodes(), infra.getInfraRouteGraph().nodes());
        assertEquals(graph.edges().size(), infra.getInfraRouteGraph().edges().size());
        testTinyInfraDiDetectorGraph(graph, infra.getDetectorMap());

        var bal3Routes = new HashSet<BAL3.BAL3Route>();
        for (var route : graph.edges()) {
            assert route instanceof BAL3.BAL3Route;
            bal3Routes.add((BAL3.BAL3Route) route);
        }

        for (var route : bal3Routes) {
            // Checks that the entry / exit signal is empty if the route starts / ends with a buffer stop
            var splitName = route.getInfraRoute().getID().split("->");
            var startBufferStop = splitName[0].contains("buffer_stop");
            var endBufferStop = splitName[1].contains("buffer_stop");
            assertEquals(startBufferStop, route.entrySignal() == null);
            assertEquals(endBufferStop, route.exitSignal() == null);

            // Checks that signal dependencies contain what they need
            if (route.entrySignal() != null) {
                assertTrue(route.entrySignal().getRouteDependencies().contains(route.getInfraRoute()));
                if (route.exitSignal() != null)
                    assertTrue(route.entrySignal().getSignalDependencies().contains(route.exitSignal()));
            }
        }
    }
}
