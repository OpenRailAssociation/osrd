package fr.sncf.osrd.new_infra.api.signaling;

import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.new_infra_state.api.InfraStateView;
import fr.sncf.osrd.new_infra_state.api.SignalizationStateView;
import java.util.Set;

/**
 * The stateless, static and immutable infrastructure signal.
 * It has an associated SignalState per simulation
 */
public interface Signal<StateT extends SignalState> {
    /** Returns the initial state of the signal */
    StateT getInitialState();

    /** When something this signal depends on changes, this function is called */
    StateT processDependencyUpdate(InfraStateView infraState, SignalizationStateView signalization);

    /** Returns a list of signals whose state change triggers an update */
    Set<? extends Signal<?>> getSignalDependencies();

    /** Returns a list of routes whose state change triggers an update */
    Set<? extends ReservationRoute> getRouteDependencies();

    /** Returns the signal ID */
    String getID();
}
