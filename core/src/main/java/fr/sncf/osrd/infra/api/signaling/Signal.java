package fr.sncf.osrd.infra.api.signaling;

import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.dyn_infra.api.InfraStateView;
import fr.sncf.osrd.dyn_infra.api.SignalizationStateView;
import java.util.Set;

/**
 * The stateless, static and immutable infrastructure signal.
 * It has an associated SignalState per simulation
 */
public interface Signal<StateT extends SignalState> {
    /** Returns the type metadata associated with the signal */
    SignalType<?, StateT> getType();

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

    /** Returns a set of routes protected by this signal. May be empty if the signal isn't linked to a detector */
    Set<ReservationRoute> getProtectedRoutes();
}
