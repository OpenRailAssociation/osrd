package fr.sncf.osrd.infra.trackgraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railscript.value.RSMatchable;
import fr.sncf.osrd.simulation.*;

public class Switch extends TrackNode {
    Switch(TrackGraph graph, int index, String id) {
        super(index, id);
        graph.registerNode(this);
    }

    public Switch.State newState() {
        return new Switch.State(this);
    }

    /** The state of the route is the actual entity which interacts with the rest of the infrastructure */
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static final class State extends Entity implements RSMatchable {
        public final Switch switchRef;
        public SwitchPosition position;

        State(Switch switchRef) {
            super(EntityType.SWITCH, switchRef.id);
            this.switchRef = switchRef;
            this.position = SwitchPosition.LEFT;
        }

        @Override
        protected void onTimelineEventUpdate(
                Simulation sim, TimelineEvent<?> event, TimelineEvent.State state
        ) throws SimulationError {
        }

        @Override
        public int getEnumValue() {
            return position.ordinal();
        }
    }
}
