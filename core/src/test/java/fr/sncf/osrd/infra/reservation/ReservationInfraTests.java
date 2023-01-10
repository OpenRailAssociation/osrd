package fr.sncf.osrd.infra.reservation;

import static fr.sncf.osrd.infra.InfraHelpers.testTinyInfraDiDetectorGraph;
import static org.junit.jupiter.api.Assertions.*;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.errors.DiscontinuousRoute;
import fr.sncf.osrd.infra.implementation.reservation.ReservationInfraBuilder;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import org.junit.jupiter.api.Test;

public class ReservationInfraTests {

    @Test
    public void testTinyInfra() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var reservationInfra = ReservationInfraBuilder.fromRJS(rjsInfra, new DiagnosticRecorderImpl(true));
        var graph = reservationInfra.getInfraRouteGraph();
        assertEquals(rjsInfra.routes.size(), graph.edges().size());
        testTinyInfraDiDetectorGraph(reservationInfra.getInfraRouteGraph(), reservationInfra.getDetectorMap());
    }

    @Test
    public void testTrackToRouteMap() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var reservationInfra = ReservationInfraBuilder.fromRJS(rjsInfra, new DiagnosticRecorderImpl(true));
        var map = reservationInfra.getRoutesOnEdges();

        for (var route : reservationInfra.getInfraRouteGraph().edges()) {
            double offset = 0;
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

    @Test
    public void testInvalidRouteMissingSwitch() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        for (var route : rjsInfra.routes)
            if (route.getID().equals("rt.tde.foo_b-switch_foo->buffer_stop_c"))
                route.switchesDirections.remove("il.switch_foo");
        var wr = new DiagnosticRecorderImpl(false);
        assertThrows(DiscontinuousRoute.class, () -> ReservationInfraBuilder.fromRJS(rjsInfra, wr));
        assertTrue(wr.warnings.isEmpty());
    }

    @Test
    public void testInvalidRouteEnd() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        for (var route : rjsInfra.routes)
            if (route.getID().equals("rt.tde.foo_b-switch_foo->buffer_stop_c"))
                route.entryPointDirection = EdgeDirection.STOP_TO_START;
        var wr = new DiagnosticRecorderImpl(false);
        assertThrows(DiscontinuousRoute.class, () -> ReservationInfraBuilder.fromRJS(rjsInfra, wr));
        assertTrue(wr.warnings.isEmpty());
    }
}
