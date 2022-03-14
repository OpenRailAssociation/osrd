package fr.sncf.osrd.new_infra.reservation;

import com.google.common.collect.Sets;
import com.google.common.graph.Traverser;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.new_infra.implementation.reservation.Parser;
import org.junit.jupiter.api.Test;
import java.util.Set;
import static fr.sncf.osrd.new_infra.InfraHelpers.assertSetMatch;
import static fr.sncf.osrd.new_infra.api.Direction.BACKWARD;
import static fr.sncf.osrd.new_infra.api.Direction.FORWARD;
import static org.junit.jupiter.api.Assertions.assertEquals;

public class ReservationInfraTests {
    @Test
    public void testTinyInfra() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var reservationInfra = Parser.fromRJS(rjsInfra);
        var graph = reservationInfra.getInfraRouteGraph();
        assertEquals(rjsInfra.routes.size(), graph.edges().size());
        var bufferStopA = reservationInfra.getDiDetector("buffer_stop_a", FORWARD);
        var bufferStopB = reservationInfra.getDiDetector("buffer_stop_b", FORWARD);
        var bufferStopC = reservationInfra.getDiDetector("buffer_stop_c", FORWARD);
        var bufferStopABackward = reservationInfra.getDiDetector("buffer_stop_a", BACKWARD);
        var bufferStopBBackward = reservationInfra.getDiDetector("buffer_stop_b", BACKWARD);
        var bufferStopCBackward = reservationInfra.getDiDetector("buffer_stop_c", BACKWARD);
        var allDirectedBufferStops = Set.of(
                bufferStopA,
                bufferStopB,
                bufferStopC,
                bufferStopABackward,
                bufferStopBBackward,
                bufferStopCBackward
        );
        var reachableFromA = Set.of(
                bufferStopA,
                bufferStopC
        );
        var reachableFromB = Set.of(
                bufferStopB,
                bufferStopC
        );
        var reachableFromC = Set.of(
                bufferStopABackward,
                bufferStopBBackward,
                bufferStopCBackward
        );
        final var traverser = Traverser.forGraph(graph);
        assertSetMatch(
                traverser.breadthFirst(bufferStopA),
                reachableFromA,
                Sets.difference(allDirectedBufferStops, reachableFromA)
        );
        assertSetMatch(
                traverser.breadthFirst(bufferStopB),
                reachableFromB,
                Sets.difference(allDirectedBufferStops, reachableFromB)
        );
        assertSetMatch(
                traverser.breadthFirst(bufferStopCBackward),
                reachableFromC,
                Sets.difference(allDirectedBufferStops, reachableFromC)
        );
    }
}
