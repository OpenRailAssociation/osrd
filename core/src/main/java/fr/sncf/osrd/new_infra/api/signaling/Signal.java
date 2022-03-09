package fr.sncf.osrd.new_infra.api.signaling;

import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import java.util.List;

/**
 * The stateless, static and immutable infrastructure signal.
 * It has an associated SignalState per simulation
 */
public interface Signal<StateT extends SignalState> {
    /** Returns the initial state of the signal */
    StateT getInitialState();

    /** When something this signal depends on changes, this function is called */
    StateT processDependencyUpdate(Void infraState);

    /** Returns a list of signals whose state change triggers an update */
    List<? extends Signal<?>> getSignalDependencies();

    /** Returns a list of routes whose state change triggers an update */
    List<? extends ReservationRoute> getRouteDependencies();
}
