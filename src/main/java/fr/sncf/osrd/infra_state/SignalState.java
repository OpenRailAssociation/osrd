package fr.sncf.osrd.infra_state;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railscript.RSDelayHandler;
import fr.sncf.osrd.infra.railscript.RSExprState;
import fr.sncf.osrd.infra.railscript.value.RSAspectSet;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.infra_state.events.SignalDelayedUpdateEvent;
import fr.sncf.osrd.simulation.EntityChange;
import fr.sncf.osrd.simulation.Simulation;

/**
 * The state of the signal is the actual entity which interacts with the rest of the infrastructure
 */
public final class SignalState implements RSValue {
    public final Signal signal;
    public RSAspectSet aspects;
    public final RSExprState<RSAspectSet> exprState;

    private SignalState(Signal signal, RSExprState<RSAspectSet> exprState) {
        this.signal = signal;
        this.exprState = exprState;
        this.aspects = signal.getInitialAspects();
    }

    public static SignalState from(Signal signal) {
        return new SignalState(signal, signal.expr.makeState());
    }

    /**
     * Eval aspect when a dependency changed
     */
    public void notifyChange(Simulation sim) {
        var delayHandler = new DelayHandler(sim, this);
        var newAspects = exprState.evalInputChange(sim.infraState, delayHandler);
        updateAspect(sim, newAspects);
    }

    /**
     * Notify the signal when a SignalDelayUpdateEvent occurred
     */
    public void notifyDelayChange(Simulation sim, int delaySlot, RSValue value) {
        var delayHandler = new DelayHandler(sim, this);
        var newAspects = exprState.evalDelayUpdate(sim.infraState, delayHandler, delaySlot, value);
        updateAspect(sim, newAspects);
    }

    private void updateAspect(Simulation sim, RSAspectSet newAspects) {
        if (newAspects != null && !newAspects.equals(aspects)) {
            var change = new SignalAspectChange(sim, this, newAspects);
            change.apply(sim, this);
            sim.publishChange(change);
            for (var signal : signal.signalSubscribers) {
                var signalState = sim.infraState.getSignalState(signal.index);
                signalState.notifyChange(sim);
            }
        }
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(RSValue otherVal) {
        if (otherVal.getClass() != SignalState.class)
            return false;
        var other = (SignalState) otherVal;
        if (!signal.id.equals(other.signal.id))
            return false;
        if (!aspects.deepEquals(other.aspects))
            return false;
        return exprState.deepEquals(other.exprState);
    }

    public static final class SignalAspectChange extends EntityChange<SignalState, Void> {
        public final RSAspectSet aspects;
        public final int signalIndex;

        protected SignalAspectChange(Simulation sim, SignalState entity, RSAspectSet aspects) {
            super(sim);
            this.aspects = aspects;
            this.signalIndex = entity.signal.index;
        }

        @Override
        public Void apply(Simulation sim, SignalState entity) {
            entity.aspects = aspects;
            return null;
        }

        @Override
        public SignalState getEntity(Simulation sim) {
            return sim.infraState.getSignalState(signalIndex);
        }

        @Override
        public String toString() {
            return String.format("SignalAspectChange { signal: %d, aspects: %s }", signalIndex, aspects.toString());
        }
    }

    static class DelayHandler implements RSDelayHandler {
        private final Simulation sim;
        private final SignalState signalState;

        DelayHandler(Simulation sim, SignalState signalState) {
            this.sim = sim;
            this.signalState = signalState;
        }

        @Override
        public void planDelayedUpdate(int delaySlot, RSValue value, double delay) {
            SignalDelayedUpdateEvent.plan(sim, sim.getTime() + delay, delaySlot, value, signalState);
        }
    }
}
