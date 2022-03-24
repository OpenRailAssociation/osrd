package fr.sncf.osrd.new_infra_state.implementation;

import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.exceptions.ErrorContext;
import fr.sncf.osrd.exceptions.OSRDError;
import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.new_infra.api.signaling.Signal;
import fr.sncf.osrd.new_infra.api.signaling.SignalState;
import fr.sncf.osrd.new_infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.new_infra_state.api.InfraStateView;
import fr.sncf.osrd.new_infra_state.api.SignalizationState;
import java.util.*;

public class SignalizationEngine implements SignalizationState {

    private final Map<Signal<?>, SignalState> signalStates;
    private final ImmutableMultimap<Signal<?>, Signal<?>> signalSubscribers;
    private final ImmutableMultimap<ReservationRoute, Signal<?>> routeSubscribers;
    private final InfraStateView infraState;

    /** Constructor */
    public SignalizationEngine(
            InfraStateView infraState,
            Map<Signal<?>, SignalState> signalStates,
            ImmutableMultimap<Signal<?>, Signal<?>> signalSubscribers,
            ImmutableMultimap<ReservationRoute, Signal<?>> routeSubscribers
    ) {
        this.signalStates = signalStates;
        this.signalSubscribers = signalSubscribers;
        this.routeSubscribers = routeSubscribers;
        this.infraState = infraState;
    }

    /** Creates a SignalizationEngine from a signaling infra and an infra state view */
    public static SignalizationEngine from(
            SignalingInfra infra,
            InfraStateView infraState
    ) {
        var signalStates = initSignalStates(infra);
        return new SignalizationEngine(
                infraState,
                initSignalStates(infra),
                initSignalSubscribers(signalStates.keySet()),
                initRouteSubscribers(signalStates.keySet())
        );
    }

    /** Initializes the map of signal dependencies (values are signals to be updated when the key signal is updated) */
    private static ImmutableMultimap<Signal<?>, Signal<?>> initSignalSubscribers(
            Collection<Signal<?>> signalStates
    ) {
        var res = ImmutableMultimap.<Signal<?>, Signal<?>>builder();
        for (var signal : signalStates)
            for (var otherSignal : signal.getSignalDependencies())
                res.put(otherSignal, signal);
        return res.build();
    }

    /** Initializes the map of route dependencies (values are signals to be updated when the key route is updated) */
    private static ImmutableMultimap<ReservationRoute, Signal<?>> initRouteSubscribers(
            Collection<Signal<?>> signalStates
    ) {
        var res = ImmutableMultimap.<ReservationRoute, Signal<?>>builder();
        for (var signal : signalStates)
            for (var route : signal.getRouteDependencies())
                res.put(route, signal);
        return res.build();
    }

    /** Initializes the map of signal -> signalState */
    private static Map<Signal<?>, SignalState> initSignalStates(SignalingInfra infra) {
        var res = new HashMap<Signal<?>, SignalState>();
        for (var signal : infra.getSignalMap().values())
            res.put(signal, signal.getInitialState());
        return res;
    }

    @Override
    @SuppressWarnings("unchecked") // We know the types match, but we lose that information when going through the map
    public <T extends SignalState> T getSignalState(Signal<T> signal) {
        return (T) signalStates.get(signal);
    }

    @Override
    public Set<Signal<?>> notifyUpdate(ReservationRoute route) {
        var res = new HashSet<Signal<?>>();
        var subscribedSignals = routeSubscribers.get(route);
        for (var signal : subscribedSignals)
            updateSignal(signal, new HashSet<>(), res);
        return res;
    }

    /** Updates a signal, then all of its subscribers.
     * On infinite loop, throws a `SignalizationError` with a "stack trace" of the processed signals */
    private void updateSignal(
            Signal<?> signal,
            HashSet<Signal<?>> modifiedSignalsInCurrentUpdate,
            HashSet<Signal<?>> updated
    ) {
        try {
            if (modifiedSignalsInCurrentUpdate.contains(signal))
                throw new SignalizationError(
                        "Infinite loop in signal dependency updates",
                        OSRDError.ErrorCause.USER // This would be caused by invalid infrastructures
                );
            modifiedSignalsInCurrentUpdate.add(signal);
            var newSignalState = signal.processDependencyUpdate(infraState, this);
            if (!newSignalState.equals(signalStates.get(signal))) {
                updated.add(signal);
                signalStates.put(signal, newSignalState);
                for (var otherSignal : signalSubscribers.get(signal))
                    updateSignal(otherSignal, modifiedSignalsInCurrentUpdate, updated);
            }
        } catch (OSRDError e) {
            throw e.withContext(new ErrorContext.Signal(signal.getID()));
        }
    }
}
