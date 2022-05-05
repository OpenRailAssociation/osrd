package fr.sncf.osrd.infra.implementation.signaling.modules.bal3;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.Signal;
import fr.sncf.osrd.infra.api.signaling.SignalingModule;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.RJSObjectParsing;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import fr.sncf.osrd.reporting.warnings.Warning;
import fr.sncf.osrd.reporting.warnings.WarningRecorder;
import java.util.HashMap;
import java.util.Map;

/** This module implements the BAL3 signaling system.
 * It will eventually be moved to an external module */
public class BAL3 implements SignalingModule {

    private final WarningRecorder warningRecorder;

    public enum Aspect {
        GREEN,
        YELLOW,
        RED
    }

    public BAL3(WarningRecorder warningRecorder) {
        this.warningRecorder = warningRecorder;
    }

    private final Map<DiDetector, BAL3Signal> detectorToSignal = new HashMap<>();

    public record BAL3Route(
            ReservationRoute infraRoute,
            Signal<?> entrySignal,
            Signal<?> exitSignal
    ) implements SignalingRoute {
        @Override
        public ReservationRoute getInfraRoute() {
            return infraRoute;
        }

        @Override
        public Signal<?> getEntrySignal() {
            return entrySignal;
        }
        
        public String getSignalingType() {
            return "BAL3";
        }
    }

    @Override
    public ImmutableMap<RJSSignal, Signal<?>> createSignals(ReservationInfra infra, RJSInfra rjsInfra) {
        var res = ImmutableMap.<RJSSignal, Signal<?>>builder();
        for (var signal : rjsInfra.signals) {
            if (!isBALSignal(signal))
                continue;
            DiDetector linkedDetector = null;
            if (signal.linkedDetector != null) {
                var undirectedDetector = RJSObjectParsing.getDetector(signal.linkedDetector, infra.getDetectorMap());
                var dir = signal.direction == EdgeDirection.START_TO_STOP ? Direction.FORWARD : Direction.BACKWARD;
                linkedDetector = undirectedDetector.getDiDetector(dir);
            }
            var newSignal = new BAL3Signal(signal.id, signal.sightDistance);
            res.put(signal, newSignal);
            detectorToSignal.put(linkedDetector, newSignal);
        }
        return res.build();
    }

    @Override
    public ImmutableMap<ReservationRoute, SignalingRoute> createRoutes(
            ReservationInfra infra,
            ImmutableMultimap<RJSSignal, Signal<?>> signalMap
    ) {
        var res = ImmutableMap.<ReservationRoute, SignalingRoute>builder();
        var graph = infra.getInfraRouteGraph();
        for (var infraRoute : graph.edges()) {
            if (!isBALRoute(infraRoute))
                continue;
            var detectors = graph.incidentNodes(infraRoute);
            var startSignal = detectorToSignal.get(detectors.nodeU());
            var endSignal = detectorToSignal.get(detectors.nodeV());
            if (startSignal == null && graph.inEdges(detectors.nodeU()).size() > 0)
                warningRecorder.register(new Warning(String.format(
                        "Can't find BAL entry signal for route %s (entry point: %s)",
                        infraRoute.getID(), detectors.nodeU()
                )));
            var newRoute = new BAL3Route(infraRoute, startSignal, endSignal);
            res.put(infraRoute, newRoute);
            if (startSignal != null) {
                startSignal.protectedRoutes.add(newRoute);
                if (endSignal != null)
                    startSignal.signalDependencies.add(endSignal);
            }
        }
        return res.build();
    }

    private static boolean isBALSignal(RJSSignal signal) {
        // TODO
        return true;
    }

    private static boolean isBALRoute(ReservationRoute route) {
        // TODO
        return true;
    }
}
