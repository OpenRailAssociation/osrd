package fr.sncf.osrd.infra.signaling;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.StatefulInfraObject;
import fr.sncf.osrd.simulation.*;

import java.util.ArrayList;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class Signal extends StatefulInfraObject<Signal.State> {
    public final String id;
    public final SignalFunction function;
    public final String[] arguments;

    /** The static data describing a signal */
    public Signal(String id, SignalFunction function, String[] arguments) {
        this.id = id;
        this.function = function;
        this.arguments = arguments;
    }

    @Override
    public State newState() {
        return new State(this, new Entity[arguments.length]);
    }

    /** The state of the signal is the actual entity which interacts with the rest of the infrastructure */
    public static final class State extends Entity {
        public final Signal signal;
        public final ArrayList<Aspect> aspects;
        public final Entity[] arguments;

        State(Signal signal, Entity[] arguments) {
            super(EntityType.SIGNAL, signal.id);
            this.signal = signal;
            this.arguments = arguments;
            this.aspects = new ArrayList<>();
        }

        @Override
        public void initialize() {

        }

        @Override
        protected void onTimelineEventUpdate(
                Simulation sim, TimelineEvent<?> event, TimelineEvent.State state
        ) throws SimulationError {
        }
    }
}
