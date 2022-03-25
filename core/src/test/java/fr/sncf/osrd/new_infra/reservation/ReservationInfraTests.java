package fr.sncf.osrd.new_infra.reservation;

import static fr.sncf.osrd.new_infra.InfraHelpers.testTinyInfraDiDetectorGraph;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.new_infra.implementation.reservation.ReservationInfraBuilder;
import org.junit.jupiter.api.Test;

public class ReservationInfraTests {

    @Test
    public void testTinyInfra() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var reservationInfra = ReservationInfraBuilder.fromRJS(rjsInfra);
        var graph = reservationInfra.getInfraRouteGraph();
        assertEquals(rjsInfra.routes.size(), graph.edges().size());
        testTinyInfraDiDetectorGraph(reservationInfra.getInfraRouteGraph(), reservationInfra.getDetectorMap());
    }
}
