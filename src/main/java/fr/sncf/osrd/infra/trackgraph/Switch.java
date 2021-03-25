package fr.sncf.osrd.infra.trackgraph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railscript.value.RSMatchable;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.simulation.*;

import java.util.ArrayList;

public class Switch extends TrackNode {
    public final int switchIndex;
    public TrackSection leftTrackSection;
    public TrackSection rightTrackSection;
    public ArrayList<Signal> signalSubscribers;

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

    /** The state of the route is the actual entity which interacts with the rest of the infrastructure */
    @SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
    public static final class State implements RSMatchable {
        public final Switch switchRef;

        private SwitchPosition position;

        State(Switch switchRef) {
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
                sim.publishChange(change);
                for (var signal : switchRef.signalSubscribers) {
                    var signalState = sim.infraState.getSignalState(signal.index);
                    signalState.notifyChange(sim);
                }
            }
        }
        @Override
        public int getEnumValue() {
            return position.ordinal();
        }

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(RSValue other) {
            if (other.getClass() != State.class)
                return false;
            var o = (State) other;
            return o.position == position && o.switchRef == switchRef;
        }
    }

    public static final class SwitchPositionChange extends EntityChange<Switch.State, Void>
            implements TimelineEventValue {
        SwitchPosition position;
        public final int switchIndex;

        protected SwitchPositionChange(Simulation sim, Switch.State entity, SwitchPosition position) {
            super(sim);
            this.position = position;
            this.switchIndex = entity.switchRef.switchIndex;
        }

        @Override
        public Void apply(Simulation sim, Switch.State entity) {
            entity.position = position;
            return null;
        }

        @Override
        public Switch.State getEntity(Simulation sim) {
            return sim.infraState.getSwitchState(switchIndex);
        }

        @Override
        @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
        public boolean deepEquals(TimelineEventValue other) {
            if (other.getClass() != SwitchPositionChange.class)
                return false;
            var o = (SwitchPositionChange) other;
            return o.switchIndex == switchIndex && o.position == position;
        }
    }
}
