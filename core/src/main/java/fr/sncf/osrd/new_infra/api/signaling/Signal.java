package fr.sncf.osrd.new_infra.api.signaling;

import fr.sncf.osrd.new_infra.api.detection.Route;
import java.util.List;

/**
 * The stateless, static and immutable infrastructure signal.
 * It has an associated SignalState per simulation
 */
public interface Signal<StateT extends SignalState> {
    /** Returns the initial state of the signal */
    StateT getInitialState();

    /** When something this signal depends on changes, this function is called */
    StateT processDependencyUpdate(Void state, StateT previousSignalState);

    /** Returns a list of signals whose state change triggers an update */
    List<? extends Signal<?>> getSignalDependencies();

    /** Returns a list of routes whose state change triggers an update */
    List<Route> getRouteDependencies();
}
