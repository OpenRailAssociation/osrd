package fr.sncf.osrd.infra_state.events;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra_state.SignalState;
import fr.sncf.osrd.simulation.*;

public class SignalDelayedUpdateEvent extends TimelineEvent {
    public final int delaySlot;
    public final RSValue value;
    private final int signalIndex;

    private SignalDelayedUpdateEvent(TimelineEventId eventId, int delaySlot, RSValue value, SignalState entity) {
        super(eventId);
        this.delaySlot = delaySlot;
        this.value = value;
        this.signalIndex = entity.signal.index;
    }

    @Override
    protected void onOccurrence(Simulation sim) {
        var signal = sim.infraState.getSignalState(signalIndex);
        signal.notifyDelayChange(sim, delaySlot, value);
    }

    @Override
    protected void onCancellation(Simulation sim) throws SimulationError {
        throw new SimulationError("cancelling DelayUpdateEvent not supported");
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(TimelineEvent other) {
        if (other.getClass() != SignalDelayedUpdateEvent.class)
            return false;
        var o = (SignalDelayedUpdateEvent) other;
        if (delaySlot != ((SignalDelayedUpdateEvent) other).delaySlot)
            return false;
        return value.deepEquals(o.value);
    }

    /** Plan a SignalDelayUpdateEvent creating a change that schedule it */
    public static SignalDelayedUpdateEvent plan(
            Simulation sim,
            double time,
            int delaySlot,
            RSValue value,
            SignalState signal
    ) {
        var change = new SignalPlanDelayUpdateChange(sim, delaySlot, value, signal.signal.index, time);
        var event = change.apply(sim, signal);
        sim.publishChange(change);
        return event;
    }

    public static final class SignalPlanDelayUpdateChange extends Simulation.TimelineEventCreated {
        public final int delaySlot;
        public final RSValue value;
        private final int signalIndex;

        private SignalPlanDelayUpdateChange(
                Simulation sim,
                int delaySlot,
                RSValue value,
                int signalIndex,
                double updateTime
        ) {
            super(sim, updateTime);
            this.delaySlot = delaySlot;
            this.value = value;
            this.signalIndex = signalIndex;
        }

        private SignalDelayedUpdateEvent apply(Simulation sim, SignalState entity) {
            var event = new SignalDelayedUpdateEvent(eventId, delaySlot, value, entity);
            super.scheduleEvent(sim, event);
            return event;
        }

        @Override
        public void replay(Simulation sim) {
            apply(sim, sim.infraState.getSignalState(signalIndex));
        }

        @Override
        public String toString() {
            return String.format("SignalPlanDelayUpdateChange { eventId=%s, signal=%d, delaySlot=%d }",
                    eventId, signalIndex, delaySlot);
        }
    }
}
