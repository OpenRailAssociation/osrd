package fr.sncf.osrd.infra.signaling;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.*;
import fr.sncf.osrd.infra.railscript.value.RSAspectSet;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainInteractionType;
import fr.sncf.osrd.utils.graph.ApplicableDirections;

import java.util.ArrayList;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class Signal implements ActionPoint {
    public final int index;
    public final String id;
    public final RSStatefulExpr<RSAspectSet> expr;
    public final ArrayList<Signal> signalSubscribers = new ArrayList<>();
    public final ApplicableDirections direction;

    private RSAspectSet initialAspects = new RSAspectSet();

    /** The static data describing a signal */
    public Signal(
            int index,
            String id,
            RSStatefulExpr<RSAspectSet> expr,
            ApplicableDirections direction
    ) {
        this.index = index;
        this.id = id;
        this.expr = expr;
        this.direction = direction;
    }

    public State newState() {
        return new State(this, expr.makeState());
    }

    public void evalInitialAspect(Infra.State initialState) {
        initialAspects = initialState.getSignalState(index).exprState.evalInit(initialState);
    }

    @Override
    public TrainInteractionType getInteractionType() {
        return TrainInteractionType.HEAD;
    }

    @Override
    public double getActionDistance() {
        return 0;
    }

    @Override
    public void interact(Simulation sim, Train train, TrainInteractionType interactionType) {
        // TODO
    }

    public RSAspectSet getInitialAspects() {
        return initialAspects;
    }

    /** The state of the signal is the actual entity which interacts with the rest of the infrastructure */
    public static final class State implements RSValue {
        public final Signal signal;
        public RSAspectSet aspects;
        public final RSExprState<RSAspectSet> exprState;

        State(Signal signal, RSExprState<RSAspectSet> exprState) {
            this.signal = signal;
            this.exprState = exprState;
            this.aspects = signal.initialAspects;
        }

        /** Eval aspect when a dependency changed */
        public void notifyChange(Simulation sim) {
            var delayHandler = new DelayHandler(sim, this);
            var newAspects = exprState.evalInputChange(sim.infraState, delayHandler);
            updateAspect(sim, newAspects);
        }

        /**  */
        public void notifyDelayChange(Simulation sim, int delaySlot, RSValue value) {
            var delayHandler = new DelayHandler(sim, this);
            var newAspects = exprState.evalDelayUpdate(sim.infraState, delayHandler, delaySlot, value);
            updateAspect(sim, newAspects);
        }

        private void updateAspect(Simulation sim, RSAspectSet newAspects)  {
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
            if (otherVal.getClass() != Signal.State.class)
                return false;
            var other = (Signal.State) otherVal;
            if (!signal.id.equals(other.signal.id))
                return false;
            if (!aspects.deepEquals(other.aspects))
                return false;
            return exprState.deepEquals(other.exprState);
        }
    }

    public static final class SignalAspectChange extends EntityChange<State, Void>
            implements TimelineEventValue {
        public final RSAspectSet aspects;
        private final int signalIndex;

        protected SignalAspectChange(Simulation sim, Signal.State entity, RSAspectSet aspects) {
            super(sim);
            this.aspects = aspects;
            this.signalIndex = entity.signal.index;
        }

        @Override
        public Void apply(Simulation sim, Signal.State entity) {
            entity.aspects = aspects;
            return null;
        }

        @Override
        public Signal.State getEntity(Simulation sim) {
            return sim.infraState.getSignalState(signalIndex);
        }

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(TimelineEventValue other) {
            if (other.getClass() != SignalAspectChange.class)
                return false;
            var o = ((SignalAspectChange) other);
            if (!super.equals(o))
                return false;
            return signalIndex == o.signalIndex;
        }
    }

    public static final class SignalDelayUpdateEvent extends TimelineEvent {
        public final int delaySlot;
        public final RSValue value;
        private final int signalIndex;

        public SignalDelayUpdateEvent(TimelineEventId eventId, int delaySlot, RSValue value, Signal.State entity) {
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
        public boolean deepEquals(TimelineEvent other) {
            if (other.getClass() != SignalDelayUpdateEvent.class)
                return false;
            var o = (SignalDelayUpdateEvent) other;
            if (delaySlot != ((SignalDelayUpdateEvent) other).delaySlot)
                return false;
            return value.deepEquals(o.value);
        }
    }

    public static class DependenciesFinder extends RSExprVisitor {
        final Signal signal;

        public DependenciesFinder(Signal signal) {
            this.signal = signal;
        }

        @Override
        public void visit(RSExpr.SignalRef expr) throws InvalidInfraException {
            expr.signal.signalSubscribers.add(signal);
            super.visit(expr);
        }

        @Override
        public void visit(RSExpr.RouteRef expr) throws InvalidInfraException {
            expr.route.signalSubscribers.add(signal);
            super.visit(expr);
        }

        @Override
        public void visit(RSExpr.SwitchRef expr) throws InvalidInfraException {
            expr.switcRef.signalSubscribers.add(signal);
            super.visit(expr);
        }
    }

    static class DelayHandler implements RSDelayHandler {

        private final Simulation sim;
        private final State signalState;

        DelayHandler(Simulation sim, State signalState) {
            this.sim = sim;
            this.signalState = signalState;
        }

        @Override
        public void planDelayedUpdate(int delaySlot, RSValue value, double delay) {
            var eventId = sim.nextEventId(sim.getTime() + delay);
            var event = new SignalDelayUpdateEvent(eventId, delaySlot, value, signalState);
            sim.scheduleEvent(event);
        }
    }
}
