package fr.sncf.osrd.infra.signaling;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railscript.RSExpr;
import fr.sncf.osrd.infra.railscript.RSStatefulExpr;
import fr.sncf.osrd.infra.railscript.value.RSAspectSet;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.utils.SortedArraySet;

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
        return new State(this);
    }

    /** The state of the signal is the actual entity which interacts with the rest of the infrastructure */
    public static final class State extends Entity implements RSValue {
        public final Signal signal;
        public final SortedArraySet<Aspect> aspects;

        State(Signal signal) {
            super(EntityType.SIGNAL, signal.id);
            this.signal = signal;
            this.aspects = new SortedArraySet<>();
        }

        private void update() {

        }

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
