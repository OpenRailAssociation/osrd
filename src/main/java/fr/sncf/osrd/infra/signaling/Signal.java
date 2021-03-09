package fr.sncf.osrd.infra.signaling;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railscript.RSExprState;
import fr.sncf.osrd.infra.railscript.RSStatefulExpr;
import fr.sncf.osrd.infra.railscript.value.RSAspectSet;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.simulation.*;

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
            this.aspects = exprState.evalInputChange(sim.infraState, null);
        }
    }
}
