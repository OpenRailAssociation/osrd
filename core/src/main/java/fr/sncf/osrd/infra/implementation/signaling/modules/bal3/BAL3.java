package fr.sncf.osrd.infra.implementation.signaling.modules.bal3;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.Signal;
import fr.sncf.osrd.infra.api.signaling.SignalType;
import fr.sncf.osrd.infra.api.signaling.SignalingModule;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.RJSObjectParsing;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** This module implements the BAL3 signaling system.
 * It will eventually be moved to an external module */
public class BAL3 implements SignalingModule {
    public static final SignalType<?, BAL3SignalState> TYPE = SignalType.make(
            "bal3", BAL3SignalState.class, BAL3SignalState.class);

    public enum Aspect {
        GREEN,
        YELLOW,
        RED
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
    }

    @Override
    public Iterable<SignalType<?, ?>> getSupportedTypes() {
        return List.of(TYPE);
    }

    @Override
    public Signal<?> parseSignal(ReservationInfra infra, RJSSignal rjsSignal) {
        var signal = new BAL3Signal(rjsSignal.id);

        if (rjsSignal.linkedDetector != null) {
            var undirectedDetector = RJSObjectParsing.getDetector(rjsSignal.linkedDetector, infra.getDetectorMap());
            var dir = rjsSignal.direction == EdgeDirection.START_TO_STOP ? Direction.FORWARD : Direction.BACKWARD;
            var linkedDetector = undirectedDetector.getDiDetector(dir);
            detectorToSignal.put(linkedDetector, signal);
        }
        return signal;
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

    private static boolean isBALRoute(ReservationRoute route) {
        // TODO
        return true;
    }
}
