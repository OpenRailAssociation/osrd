package fr.sncf.osrd.new_infra.api.signaling.modules;

import fr.sncf.osrd.new_infra.api.detection.DirDetector;
import fr.sncf.osrd.new_infra.api.detection.Route;
import fr.sncf.osrd.new_infra.api.detection.RouteInfra;
import fr.sncf.osrd.new_infra.api.signaling.*;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import java.util.*;

/** This module implements the BAL3 signaling system.
 * It will eventually be moved to an external module */
public class BAL3 implements SignalingModule {

    public static class BAL3Signal implements Signal<BAL3Signal.BAL3SignalState> {

        final List<BAL3Signal> signalDependencies = new ArrayList<>();
        final List<Route> routeDependencies = new ArrayList<>();
        final DirDetector detector;

        public BAL3Signal(DirDetector detector) {
            this.detector = detector;
        }

        public static class BAL3SignalState implements SignalState {
            public final Set<Aspect> aspects;

            public BAL3SignalState(Set<Aspect> aspects) {
                this.aspects = aspects;
            }
        }

        @Override
        public BAL3SignalState getInitialState() {
            return new BAL3SignalState(Set.of(new Aspect("GREEN")));
        }

        @Override
        public BAL3SignalState processDependencyUpdate(Void state, BAL3SignalState previousSignalState) {
            for (var route : routeDependencies)
                if (route.getState() == Route.State.OCCUPIED)
                    return new BAL3SignalState(Set.of(new Aspect("RED")));
            for (var signal : signalDependencies) {
                BAL3SignalState otherSignalState = null; // TODO
                if (otherSignalState.aspects.contains(new Aspect("RED")))
                    return new BAL3SignalState(Set.of(new Aspect("YELLOW")));
            }
            return new BAL3SignalState(Set.of(new Aspect("GREEN")));
        }

        @Override
        public List<? extends Signal<?>> getSignalDependencies() {
            return signalDependencies;
        }

        @Override
        public List<Route> getRouteDependencies() {
            return routeDependencies;
        }
    }

    public static class BAL3Route implements SignalingRoute {
    }

    @Override
    public Map<RJSSignal, Signal<?>> createSignals(RouteInfra infra, RJSInfra rjsInfra) {
        var res = new HashMap<RJSSignal, Signal<?>>();
        for (var signal : rjsInfra.signals) {
            // TODO check if it's a bal signal
            // TODO find the linked detector
            res.put(signal, new BAL3Signal(null));
        }
        return res;
    }

    @Override
    public Map<Route, SignalingRoute> createRoutes(RouteInfra infra, Map<RJSSignal, Set<Signal<?>>> signalMap) {
        var res = new HashMap<Route, SignalingRoute>();
        for (var signalSet : signalMap.values()) {
            for (var signal : signalSet) {
                if (!(signal instanceof BAL3Signal))
                    continue;
                var bal3signal = (BAL3Signal) signal;
                for (var infraRoute : infra.getInfraRouteGraph().outEdges(bal3signal.detector)) {
                    res.put(infraRoute, new BAL3Route());
                    bal3signal.routeDependencies.add(infraRoute);
                    // TODO find if route ends with a BAL3 signal and add it as dependency
                }
            }
        }
        return res;
    }
}
