package fr.sncf.osrd.new_infra.reservation;

import static fr.sncf.osrd.new_infra.InfraHelpers.assertSetMatch;
import static fr.sncf.osrd.new_infra.api.Direction.BACKWARD;
import static fr.sncf.osrd.new_infra.api.Direction.FORWARD;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.Sets;
import com.google.common.graph.Traverser;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.new_infra.implementation.reservation.ReservationInfraBuilder;
import org.junit.jupiter.api.Test;
import java.util.Set;

public class ReservationInfraTests {

    /** Get the value in the map, throw if absent */
    public static <T, U> T safeGet(ImmutableMap<U, T> m, U x) {
        var res = m.get(x);
        if (res == null)
            throw new RuntimeException("Unexpected null value");
        return res;
    }

    @Test
    public void testTinyInfra() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var reservationInfra = ReservationInfraBuilder.fromRJS(rjsInfra);
        var graph = reservationInfra.getInfraRouteGraph();
        assertEquals(rjsInfra.routes.size(), graph.edges().size());
        var diDetectors = reservationInfra.getDiDetectorMap();
        var bufferStopA = safeGet(safeGet(diDetectors, FORWARD), "buffer_stop_a");
        var bufferStopB = safeGet(safeGet(diDetectors, FORWARD), "buffer_stop_b");
        var bufferStopC = safeGet(safeGet(diDetectors, FORWARD), "buffer_stop_c");
        var bufferStopABackward = safeGet(safeGet(diDetectors, BACKWARD), "buffer_stop_a");
        var bufferStopBBackward = safeGet(safeGet(diDetectors, BACKWARD), "buffer_stop_b");
        var bufferStopCBackward = safeGet(safeGet(diDetectors, BACKWARD), "buffer_stop_c");
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
