package fr.sncf.osrd.infra.signaling_infra;

import static fr.sncf.osrd.Helpers.infraFromRJS;
import static fr.sncf.osrd.infra.InfraHelpers.testTinyInfraDiDetectorGraph;
import static org.junit.jupiter.api.Assertions.*;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.Signal;
import fr.sncf.osrd.infra.api.signaling.SignalState;
import fr.sncf.osrd.infra.api.signaling.SignalingModule;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.reporting.exceptions.ErrorType;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import org.junit.jupiter.api.Test;
import java.util.HashSet;
import java.util.Set;

public class SignalingInfraTests {
    @Test
    public void testTinyInfra() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var infra = infraFromRJS(rjsInfra);
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

    @Test
    public void testErrorMissingSignaling() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var thrown = assertThrows(
                OSRDError.class,
                () -> SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(), new DiagnosticRecorderImpl(true))
        );
        assertEquals(thrown.osrdErrorType, ErrorType.StrictWarningError);
    }

    @Test
    public void findRoutesTests() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var wr = new DiagnosticRecorderImpl(true);
        var infra = SignalingInfraBuilder.fromRJSInfra(
                rjsInfra,
                Set.of(new BAL3(wr), new DummySignalingModule()),
                wr
        );
        assertNull(infra.findSignalingRoute("nope", "BAL3"));
        assertNull(infra.findSignalingRoute("rt.tde.foo_a-switch_foo->buffer_stop_c", "nope"));
        assertTrue(infra.findSignalingRoute(
                "rt.tde.foo_a-switch_foo->buffer_stop_c", "BAL3") instanceof BAL3.BAL3Route
        );
        assertTrue(infra.findSignalingRoute(
                "rt.tde.foo_a-switch_foo->buffer_stop_c", "Dummy") instanceof DummySignalingModule.DummyRoute
        );
    }

    private static class DummySignalingModule implements SignalingModule {

        static class DummyRoute implements SignalingRoute {

            @Override
            public ReservationRoute getInfraRoute() {
                return null;
            }

            @Override
            public Signal<?> getEntrySignal() {
                return null;
            }

            @Override
            public Signal<?> getExitSignal() {
                return null;
            }

            @Override
            public String getSignalingType() {
                return "Dummy";
            }
        }

        @Override
        public ImmutableMap<RJSSignal, Signal<? extends SignalState>> createSignals(
                ReservationInfra infra,
                RJSInfra rjsInfra
        ) {
            return ImmutableMap.of();
        }

        @Override
        public ImmutableMap<ReservationRoute, SignalingRoute> createRoutes(
                ReservationInfra infra,
                ImmutableMultimap<RJSSignal, Signal<? extends SignalState>> signalMap
        ) {
            var builder = ImmutableMap.<ReservationRoute, SignalingRoute>builder();
            for (var route : infra.getReservationRouteMap().values())
                builder.put(route, new DummyRoute());
            return builder.build();
        }
    }
}
