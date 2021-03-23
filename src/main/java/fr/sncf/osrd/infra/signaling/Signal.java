package fr.sncf.osrd.infra.signaling;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.*;
import fr.sncf.osrd.infra.railscript.value.RSAspectSet;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.routegraph.Route;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainInteractionType;
import fr.sncf.osrd.utils.graph.ApplicableDirections;

import java.util.ArrayList;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class Signal implements ActionPoint {
    public final int index;
    public final String id;
    public final RSStatefulExpr<RSAspectSet> expr;
    public final ArrayList<Signal> signalDependencies = new ArrayList<>();
    public final ArrayList<Route> routeDependencies = new ArrayList<>();
    public final ArrayList<Switch> switchDependencies = new ArrayList<>();
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

    public static final class SignalID implements EntityID<Signal.State> {
        public final int signalIndex;

        public SignalID(int signalIndex) {
            this.signalIndex = signalIndex;
        }

        @Override
        public State getEntity(Simulation sim) {
            return sim.infraState.getSignalState(signalIndex);
        }

        @Override
        public int hashCode() {
            return Integer.hashCode(signalIndex);
        }

        @Override
        public boolean equals(Object obj) {
            if (obj == null || obj.getClass() != SignalID.class)
                return false;
            return signalIndex == ((SignalID) obj).signalIndex;
        }
    }

    public RSAspectSet getInitialAspects() {
        return initialAspects;
    }

    /** The state of the signal is the actual entity which interacts with the rest of the infrastructure */
    public static final class State extends AbstractEntity<Signal.State, SignalID> implements RSValue {
        public final Signal signal;
        public RSAspectSet aspects;
        public final RSExprState<RSAspectSet> exprState;

        State(Signal signal, RSExprState<RSAspectSet> exprState) {
            super(new SignalID(signal.index));
            this.signal = signal;
            this.exprState = exprState;
            this.aspects = signal.initialAspects;
        }

        @Override
        public void onEventOccurred(Simulation sim, TimelineEvent<?> event) {
            var delayHandler = new DelayHandler(sim, this);
            RSAspectSet newAspects = null;

            if ((event.value.getClass() == SignalAspectChange.class && event.source != this)
                    || event.source.getClass() == Route.State.class) {
                // Eval aspect when a dependency changed
                newAspects = exprState.evalInputChange(sim.infraState, delayHandler);
            } else if (event.value.getClass() == SignalDelayUpdateEventValue.class && event.source == this) {
                // Check that a delay update as occurred on itself
                var delayEvent = (SignalDelayUpdateEventValue) event.value;
                newAspects = exprState.evalDelayUpdate(
                        sim.infraState,
                        delayHandler,
                        delayEvent.delaySlot,
                        delayEvent.value
                );
            }

            if (newAspects != null && !newAspects.equals(aspects)) {
                var change = new SignalAspectChange(sim, this, newAspects);
                change.apply(sim, this);
                sim.publishChange(change);
                sim.scheduleEvent(this, sim.getTime(), change);
            }
        }

        @Override
        public void onEventCancelled(Simulation sim, TimelineEvent<?> event) { }

        /** Register itself as subscriber of his dependencies */
        public void initialize(Infra.State state) {
            // Register itself to his dependencies
            for (var route : signal.routeDependencies)
                state.getRouteState(route.index).subscribers.add(this);
            for (var signal : signal.signalDependencies)
                state.getSignalState(signal.index).subscribers.add(this);
            for (var switchRef : signal.switchDependencies)
                state.getSwitchState(switchRef.switchIndex).subscribers.add(this);

            // The signal must be subscribe to itself to receive SignalDelayUpdateEventValue
            subscribers.add(this);
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

    public static final class SignalAspectChange
            extends EntityChange<State, SignalID, Void>
            implements TimelineEventValue {
        public final RSAspectSet aspects;

        protected SignalAspectChange(Simulation sim, Signal.State entity, RSAspectSet aspects) {
            super(sim, entity.id);
            this.aspects = aspects;
        }

        @Override
        public Void apply(Simulation sim, Signal.State entity) {
            entity.aspects = aspects;
            return null;
        }

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(TimelineEventValue other) {
            if (other.getClass() != SignalAspectChange.class)
                return false;
            var o = ((SignalAspectChange) other);
            if (!super.equals(o))
                return false;
            return entityId.equals(o.entityId);
        }
    }

    public static final class SignalDelayUpdateEventValue implements TimelineEventValue {
        public final int delaySlot;
        public final RSValue value;

        public SignalDelayUpdateEventValue(int delaySlot, RSValue value) {
            this.delaySlot = delaySlot;
            this.value = value;
        }

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(TimelineEventValue other) {
            if (other.getClass() != SignalDelayUpdateEventValue.class)
                return false;
            var o = (SignalDelayUpdateEventValue) other;
            if (delaySlot != ((SignalDelayUpdateEventValue) other).delaySlot)
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
            signal.signalDependencies.add(expr.signal);
            super.visit(expr);
        }

        @Override
        public void visit(RSExpr.RouteRef expr) throws InvalidInfraException {
            signal.routeDependencies.add(expr.route);
            super.visit(expr);
        }

        @Override
        public void visit(RSExpr.SwitchRef expr) throws InvalidInfraException {
            signal.switchDependencies.add(expr.switcRef);
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
            sim.scheduleEvent(
                    signalState,
                    sim.getTime() + delay,
                    new SignalDelayUpdateEventValue(delaySlot, value)
            );
        }
    }
}
