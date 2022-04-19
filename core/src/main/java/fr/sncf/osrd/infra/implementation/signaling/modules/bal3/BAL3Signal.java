package fr.sncf.osrd.infra.implementation.signaling.modules.bal3;

import static fr.sncf.osrd.infra_state.api.ReservationRouteState.Summary.FREE;
import static fr.sncf.osrd.infra_state.api.ReservationRouteState.Summary.RESERVED;

import com.google.common.base.MoreObjects;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.Signal;
import fr.sncf.osrd.infra_state.api.InfraStateView;
import fr.sncf.osrd.infra_state.api.SignalizationStateView;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

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
        var isControlled = protectedRoutes.stream()
                .anyMatch(route -> route.getInfraRoute().isControlled());
        if (isControlled)
            return new BAL3SignalState(BAL3.Aspect.RED);
        var endsWithBufferStop = protectedRoutes.stream()
                .anyMatch(route -> route.exitSignal() == null);
        if (endsWithBufferStop)
            return new BAL3SignalState(BAL3.Aspect.YELLOW);
        else
            return new BAL3SignalState(BAL3.Aspect.GREEN);
    }

    @Override
    public BAL3SignalState processDependencyUpdate(InfraStateView state, SignalizationStateView signalization) {
        var openRouteStates = Set.of(
                FREE,
                RESERVED
        );
        // Finds any free route starting from this signal
        Set<BAL3.BAL3Route> reservedRoutes = new HashSet<>();
        for (var route : protectedRoutes)
            if (openRouteStates.contains(state.getState(route.infraRoute()).summarize()))
                reservedRoutes.add(route);
        if (reservedRoutes.isEmpty())
            // All routes starting from this signal are blocked -> red
            return new BAL3SignalState(BAL3.Aspect.RED);

        if (reservedRoutes.stream().anyMatch(r -> r.infraRoute().isControlled())) {
            // At lease one route needs to be reserved
            if (reservedRoutes.stream().noneMatch(r -> state.getState(r.infraRoute()).summarize().equals(RESERVED))) {
                // No route is reserved -> red
                return new BAL3SignalState(BAL3.Aspect.RED);
            }
        }

        // Checks if the next signal is red: we look for reserved routes first
        for (var route : reservedRoutes) {
            if (state.getState(route.getInfraRoute()).summarize().equals(RESERVED)) {
                if (isNextRouteBlocked(route, signalization))
                    return new BAL3SignalState(BAL3.Aspect.YELLOW);
                else {
                    // A route is reserved and lead to a signal that isn't red, we don't need to check the rest
                    return new BAL3SignalState(BAL3.Aspect.GREEN);
                }
            }
        }

        // If no reserved route, we check all free routes starting from this signal
        for (var route : reservedRoutes) {
            if (isNextRouteBlocked(route, signalization))
                return new BAL3SignalState(BAL3.Aspect.YELLOW);
        }
        return new BAL3SignalState(BAL3.Aspect.GREEN);
    }

    /** Returns true if the signal at the end of this route is red */
    private boolean isNextRouteBlocked(BAL3.BAL3Route route, SignalizationStateView signalization) {
        if (route.exitSignal() == null) {
            // No exit signal -> this route ends with a buffer stop (equivalent to an always red signal)
            return true;
        }
        var nextSignal = signalization.getSignalState(route.exitSignal());
        if (nextSignal instanceof BAL3SignalState nextSignalState)
            return nextSignalState.aspect.equals(BAL3.Aspect.RED);
        return false;
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

    @Override
    public Set<ReservationRoute> getProtectedRoutes() {
        return protectedRoutes.stream()
                .map(BAL3.BAL3Route::getInfraRoute)
                .collect(Collectors.toSet());
    }
}
