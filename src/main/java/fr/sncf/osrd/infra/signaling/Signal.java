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

import java.util.ArrayList;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class Signal {
    public final int index;
    public final String id;
    public final RSStatefulExpr<RSAspectSet> expr;

    /** The static data describing a signal */
    public Signal(int index, String id, RSStatefulExpr<RSAspectSet> expr) {
        this.index = index;
        this.id = id;
        this.expr = expr;
    }

    public State newState() {
        return new State(this, expr.makeState());
    }

    public static class SignalID implements EntityID<Signal.State> {
        public final int signalIndex;

        public SignalID(int signalIndex) {
            this.signalIndex = signalIndex;
        }

        @Override
        public State getEntity(Simulation sim) {
            return sim.infraState.getSignalState(signalIndex);
        }
    }

    /** The state of the signal is the actual entity which interacts with the rest of the infrastructure */
    public static final class State extends AbstractEntity<Signal.State> implements RSValue {
        public final Signal signal;
        public RSAspectSet aspects;
        public final RSExprState<RSAspectSet> exprState;

        State(Signal signal, RSExprState<RSAspectSet> exprState) {
            super(new SignalID(signal.index));
            this.signal = signal;
            this.exprState = exprState;
            this.aspects = new RSAspectSet();
        }

        @Override
        public void onTimelineEventUpdate(
                Simulation sim, TimelineEvent<?> event, TimelineEvent.State state
        ) throws SimulationError {
            var newAspects = exprState.evalInputChange(sim.infraState, null);
            if (!newAspects.equals(aspects)) {
                aspects = newAspects;
                // TODO Send notification to subscribers
            }
        }

        /** Initialize the aspect and register itself as subscriber of his dependencies */
        public void initialize(Infra.State state) {
            aspects = exprState.evalInit(state);
            var dependenciesFinder = new DependenciesFinder();
            try {
                signal.expr.accept(dependenciesFinder);
            } catch (InvalidInfraException e) {
                e.printStackTrace();
            }

            // Register itself to his dependencies
            for (var route : dependenciesFinder.routeDependencies)
                state.getRouteState(route.index).subscribers.add(this);
            for (var signal : dependenciesFinder.signalDependencies)
                state.getSignalState(signal.index).subscribers.add(this);
            for (var switchRef : dependenciesFinder.switchDependencies)
                state.getSwitchState(switchRef.switchIndex).subscribers.add(this);
        }

        private static class DependenciesFinder extends RSExprVisitor {
            public final ArrayList<Signal> signalDependencies = new ArrayList<>();
            public final ArrayList<Route> routeDependencies = new ArrayList<>();
            public final ArrayList<Switch> switchDependencies = new ArrayList<>();

            @Override
            public void visit(RSExpr.SignalRef expr) throws InvalidInfraException {
                signalDependencies.add(expr.signal);
                super.visit(expr);
            }

            @Override
            public void visit(RSExpr.RouteRef expr) throws InvalidInfraException {
                routeDependencies.add(expr.route);
                super.visit(expr);
            }

            @Override
            public void visit(RSExpr.SwitchRef expr) throws InvalidInfraException {
                switchDependencies.add(expr.switcRef);
                super.visit(expr);
            }
        }
    }
}
