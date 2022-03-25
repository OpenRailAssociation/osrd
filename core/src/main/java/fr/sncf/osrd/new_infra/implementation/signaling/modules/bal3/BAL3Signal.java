package fr.sncf.osrd.new_infra.implementation.signaling.modules.bal3;

import static fr.sncf.osrd.new_infra_state.api.ReservationRouteState.Summary.FREE;
import static fr.sncf.osrd.new_infra_state.api.ReservationRouteState.Summary.RESERVED;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.new_infra.api.signaling.Signal;
import fr.sncf.osrd.new_infra_state.api.InfraStateView;
import fr.sncf.osrd.new_infra_state.api.SignalizationStateView;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.HashSet;
import java.util.Set;

public class BAL3Signal implements Signal<BAL3SignalState> {

    final Set<BAL3Signal> signalDependencies = new HashSet<>();
    final Set<BAL3.BAL3Route> protectedRoutes = new HashSet<>();
    private final String id;

    public BAL3Signal(String id) {
        this.id = id;
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("id", id)
                .toString();
    }


    @Override
    public BAL3SignalState getInitialState() {
        return new BAL3SignalState(BAL3.Aspect.GREEN);
    }

    @Override
    public BAL3SignalState processDependencyUpdate(InfraStateView state, SignalizationStateView signalization) {
        var openRouteStates = Set.of(
                FREE,
                RESERVED
        );
        // Finds any free route starting from this signal
        BAL3.BAL3Route reservedRoute = null;
        for (var route : protectedRoutes)
            if (openRouteStates.contains(state.getState(route.infraRoute()).summarize())) {
                reservedRoute = route;
                break;
            }
        if (reservedRoute == null)
            // All routes starting from this signal are blocked -> red
            return new BAL3SignalState(BAL3.Aspect.RED);

        if (reservedRoute.infraRoute().isControlled()
                && !state.getState(reservedRoute.infraRoute()).summarize().equals(RESERVED))
            // Route needs to be reserved but isn't
            return new BAL3SignalState(BAL3.Aspect.RED);

        if (reservedRoute.exitSignal() != null) {
            var nextSignal = signalization.getSignalState(reservedRoute.exitSignal());
            if (nextSignal instanceof BAL3SignalState nextSignalState)
                if (nextSignalState.aspect.equals(BAL3.Aspect.RED))
                    // Next signal is red -> yellow
                    return new BAL3SignalState(BAL3.Aspect.YELLOW);
        }
        // TODO default to red for requested routes
        return new BAL3SignalState(BAL3.Aspect.GREEN);
    }

    @Override
    public Set<? extends Signal<?>> getSignalDependencies() {
        return signalDependencies;
    }

    @Override
    public Set<ReservationRoute> getRouteDependencies() {
        var res = new HashSet<ReservationRoute>();
        for (var route : protectedRoutes)
            res.add(route.infraRoute());
        return res;
    }

    @Override
    public String getID() {
        return id;
    }
}
