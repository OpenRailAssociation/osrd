package fr.sncf.osrd.new_infra.implementation.signaling.modules;

import static fr.sncf.osrd.new_infra_state.api.ReservationRouteState.Summary.*;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.new_infra.api.signaling.*;
import fr.sncf.osrd.new_infra.implementation.RJSObjectParsing;
import fr.sncf.osrd.new_infra_state.api.InfraStateView;
import fr.sncf.osrd.new_infra_state.api.SignalizationStateView;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.awt.*;
import java.util.*;

/** This module implements the BAL3 signaling system.
 * It will eventually be moved to an external module */
public class BAL3 implements SignalingModule {

    private enum Aspect {
        GREEN,
        YELLOW,
        RED
    }

    public static class BAL3Signal implements Signal<BAL3Signal.BAL3SignalState> {

        final Set<BAL3Signal> signalDependencies = new HashSet<>();
        final Set<BAL3Route> protectedRoutes = new HashSet<>();

        public static class BAL3SignalState implements SignalState {
            public final Aspect aspect;

            public BAL3SignalState(Aspect aspect) {
                this.aspect = aspect;
            }

            @Override
            public int getRGBColor() {
                return switch (aspect) {
                    case GREEN -> Color.GREEN.getRGB();
                    case YELLOW -> Color.YELLOW.getRGB();
                    case RED -> Color.RED.getRGB();
                };
            }
        }

        @Override
        public BAL3SignalState getInitialState() {
            return new BAL3SignalState(Aspect.GREEN);
        }

        @Override
        public BAL3SignalState processDependencyUpdate(InfraStateView state, SignalizationStateView signalization) {
            var openRouteStates = Set.of(
                    FREE,
                    RESERVED
            );
            // Finds any free route starting from this signal
            BAL3Route reservedRoute = null;
            for (var route : protectedRoutes)
                if (openRouteStates.contains(state.getState(route.infraRoute).summarize())) {
                    reservedRoute = route;
                    break;
                }
            if (reservedRoute == null)
                // All routes starting from this signal are blocked -> red
                return new BAL3SignalState(Aspect.RED);

            if (reservedRoute.exitSignal != null) {
                var nextSignal = signalization.getSignalState(reservedRoute.exitSignal);
                if (nextSignal instanceof BAL3SignalState nextSignalState)
                    if (nextSignalState.aspect.equals(Aspect.RED))
                        // Next signal is red -> yellow
                        return new BAL3SignalState(Aspect.YELLOW);
            }
            // TODO default to red for requested routes
            return new BAL3SignalState(Aspect.GREEN);
        }

        @Override
        public Set<? extends Signal<?>> getSignalDependencies() {
            return signalDependencies;
        }

        @Override
        public Set<ReservationRoute> getRouteDependencies() {
            var res = new HashSet<ReservationRoute>();
            for (var route : protectedRoutes)
                res.add(route.infraRoute);
            return res;
        }
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
            var newSignal = new BAL3Signal();
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
