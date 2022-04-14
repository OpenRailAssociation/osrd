package fr.sncf.osrd.infra.reservation;

import static fr.sncf.osrd.infra.InfraHelpers.testTinyInfraDiDetectorGraph;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.implementation.reservation.ReservationInfraBuilder;
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

    @Test
    public void testTrackToRouteMap() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var reservationInfra = ReservationInfraBuilder.fromRJS(rjsInfra);
        var map = reservationInfra.getRoutesOnEdges();

        for (var route : reservationInfra.getInfraRouteGraph().edges()) {
            var offset = 0;
            for (var range : route.getTrackRanges()) {
                double trackOffset;
                if (offset > 0)
                    trackOffset = -offset;
                else {
                    if (range.track.getDirection().equals(Direction.FORWARD))
                        trackOffset = range.begin;
                    else
                        trackOffset = range.track.getEdge().getLength() - range.end;
                }
                var set = map.get(range.track);
                assertTrue(set.contains(new ReservationInfra.RouteEntry(route, trackOffset)));
                offset += range.getLength();
            }
        }
    }
}
