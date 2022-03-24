package fr.sncf.osrd.new_infra_state.implementation.standalone;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.new_infra.api.signaling.Signal;
import fr.sncf.osrd.new_infra.api.signaling.SignalState;
import fr.sncf.osrd.new_infra_state.api.NewTrainPath;
import fr.sncf.osrd.new_infra_state.api.SignalizationState;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.stream.Collectors;

/** This class connects a StandaloneState to a SignalizationState, calling the right updates */
public class StandaloneSignalingSimulation {
    public record SignalEvent<T extends SignalState>(Double position, Signal<?> signal, T state){}

    public record SignalTimedEvent<T extends SignalState>(double position, double time, Signal<?> signal, T state){}

    /** Runs a complete standalone signaling simulation, returning a sequence of signal events.
     * This overload without TrainEnvelope returns events without time, just a train position. */
    public static List<SignalEvent<?>> runWithoutEnvelope(
            NewTrainPath path,
            StandaloneState state,
            SignalizationState signalizationState
    ) {
        var res = new ArrayList<SignalEvent<?>>();
        for (var position : state.updatePositions) {
            if (position >= path.length())
                break;
            state.moveTrain(position);
            var updatedSignals = new HashSet<Signal<?>>();
            for (var route : state.routeUpdatePositions.get(position)) {
                updatedSignals.addAll(signalizationState.notifyUpdate(route));
                for (var conflictingRoute : route.getConflictingRoutes())
                    updatedSignals.addAll(signalizationState.notifyUpdate(conflictingRoute));
            }
            for (var signal : updatedSignals)
                res.add(new SignalEvent<>(position, signal, signalizationState.getSignalState(signal)));
        }
        return res;
    }

    /** Runs a complete standalone signaling simulation, returning a sequence of signal events */
    public static List<SignalTimedEvent<?>> run(
            NewTrainPath path,
            StandaloneState state,
            SignalizationState signalizationState,
            Envelope trainEnvelope
    ) {
        return runWithoutEnvelope(path, state, signalizationState).stream()
                .map(event -> addTimeToEvent(trainEnvelope, event))
                .collect(Collectors.toList());
    }

    private static <T extends SignalState> SignalTimedEvent<T> addTimeToEvent(
            Envelope trainEnvelope,
            SignalEvent<T> event
    ) {
        return new SignalTimedEvent<>(
                event.position,
                trainEnvelope.interpolateTotalTime(event.position),
                event.signal,
                event.state
        );
    }
}
