package fr.sncf.osrd.new_infra_state.api;

import fr.sncf.osrd.new_infra.api.signaling.Signal;
import fr.sncf.osrd.new_infra.api.signaling.SignalState;

public interface SignalizationStateView {
    /** Returns the state of the given signal */
    <T extends SignalState> T getSignalState(Signal<T> signal);
}
