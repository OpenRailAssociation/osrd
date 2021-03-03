package fr.sncf.osrd.infra.signaling;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.StatefulInfraObject;
import fr.sncf.osrd.infra.signaling.expr.Expr;
import fr.sncf.osrd.infra.signaling.expr.Function;
import fr.sncf.osrd.infra.signaling.expr.value.AspectSet;
import fr.sncf.osrd.infra.signaling.expr.value.IExprValue;
import fr.sncf.osrd.infra.signaling.expr.value.IMatchableValue;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.utils.SortedArraySet;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class Signal implements StatefulInfraObject<Signal.State> {
    public final String id;
    public final Expr<AspectSet> expr;

    /** The static data describing a signal */
    public Signal(String id, Expr<AspectSet> expr) {
        this.id = id;
        this.expr = expr;
    }

    @Override
    public State newState() {
        return new State(this);
    }

    /** The state of the signal is the actual entity which interacts with the rest of the infrastructure */
    public static final class State extends Entity implements IExprValue {
        public final Signal signal;
        public final SortedArraySet<Aspect> aspects;

        State(Signal signal) {
            super(EntityType.SIGNAL, signal.id);
            this.signal = signal;
            this.aspects = new SortedArraySet<>();
        }

        private void update() {
        }

        @Override
        public void initialize() {
            update();
        }

        @Override
        protected void onTimelineEventUpdate(
                Simulation sim, TimelineEvent<?> event, TimelineEvent.State state
        ) throws SimulationError {
            update();
        }
    }
}
