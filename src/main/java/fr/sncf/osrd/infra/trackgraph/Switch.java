package fr.sncf.osrd.infra.trackgraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railscript.value.RSMatchable;
import fr.sncf.osrd.simulation.*;

public class Switch extends TrackNode {
    public final int switchIndex;
    public TrackSection leftTrackSection;
    public TrackSection rightTrackSection;

    Switch(
            TrackGraph graph,
            int index,
            String id,
            int switchIndex
    ) {
        super(index, id);
        this.switchIndex = switchIndex;
        graph.registerNode(this);
    }

    public Switch.State newState() {
        return new Switch.State(this);
    }

    public static final class SwitchID implements EntityID<Switch.State> {
        private final int switchIndex;

        public SwitchID(int switchIndex) {
            this.switchIndex = switchIndex;
        }

        @Override
        public State getEntity(Simulation sim) {
            return sim.infraState.getSwitchState(switchIndex);
        }
    }

    /** The state of the route is the actual entity which interacts with the rest of the infrastructure */
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static final class State extends AbstractEntity<Switch.State, SwitchID> implements RSMatchable {
        public final Switch switchRef;

        private SwitchPosition position;

        State(Switch switchRef) {
            super(new SwitchID(switchRef.switchIndex));
            this.switchRef = switchRef;
            this.position = SwitchPosition.LEFT;
        }

        public SwitchPosition getPosition() {
            return position;
        }

        /** Return currently active branch */
        public TrackSection getBranch() {
            if (position == SwitchPosition.LEFT)
                return switchRef.leftTrackSection;
            return switchRef.rightTrackSection;
        }

        /** Change position of the switch */
        public void setPosition(Simulation sim, SwitchPosition position) {
            if (this.position != position) {
                var change = new Switch.SwitchPositionChange(sim, this, position);
                change.apply(sim, this);
                sim.scheduleEvent(this, sim.getTime(), change);
            }
        }

        @Override
        public void onEventOccurred(Simulation sim, TimelineEvent<?> event) { }

        @Override
        public void onEventCancelled(Simulation sim, TimelineEvent<?> event) { }

        @Override
        public int getEnumValue() {
            return position.ordinal();
        }
    }

    public static final class SwitchPositionChange
            extends EntityChange<Switch.State, SwitchID, Void> {
        SwitchPosition position;

        protected SwitchPositionChange(Simulation sim, Switch.State entity, SwitchPosition position) {
            super(sim, entity.id);
            this.position = position;
        }

        @Override
        public Void apply(Simulation sim, Switch.State entity) {
            entity.position = position;
            return null;
        }
    }
}
