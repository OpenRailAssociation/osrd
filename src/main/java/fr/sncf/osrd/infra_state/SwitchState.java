package fr.sncf.osrd.infra_state;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.railscript.value.RSMatchable;
import fr.sncf.osrd.infra.railscript.value.RSValue;
import fr.sncf.osrd.infra.trackgraph.Switch;
import fr.sncf.osrd.infra.trackgraph.SwitchGroup;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.infra_state.events.SwitchMoveEvent;
import fr.sncf.osrd.simulation.EntityChange;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;

/**
 * The state of the route is the actual entity which interacts with the rest of the infrastructure
 */
public final class SwitchState implements RSMatchable {
    public final Switch switchRef;

    private SwitchGroup group;

    public SwitchState(Switch switchRef) {
        this.switchRef = switchRef;
        this.group = switchRef.getDefaultGroup();
    }

    public SwitchGroup getGroup() {
        return group;
    }

    /**
     * Return currently active branch
     */
    public TrackSection getBranch(TrackSection trackSection, EdgeDirection direction) {
        var endpoint = direction.equals(EdgeDirection.START_TO_STOP) ? EdgeEndpoint.END : EdgeEndpoint.BEGIN;
        var edges = switchRef.groups.get(group);
        for (var edge : edges) {
            if (edge.src.trackSection.id.equals(trackSection.id) && edge.src.endpoint.equals(endpoint)) {
                return edge.dst.trackSection;
            }
        }
        return null;
    }

    /**
     * Change group of the switch
     */
    public void setGroup(Simulation sim, SwitchGroup group) throws SimulationError {
        if ((this.group == null && group != null) || (this.group != null && !this.group.equals(group))) {
            var change = new SwitchGroupChange(sim, this, group);
            change.apply(sim, this);
            sim.publishChange(change);
            for (var signal : switchRef.signalSubscribers) {
                var signalState = sim.infraState.getSignalState(signal.index);
                signalState.notifyChange(sim);
            }
        }
    }


    /**
     * Starts a switch change that will happen after the switch's delay
     */
    public void requestGroupChange(
            Simulation sim,
            SwitchGroup group,
            RouteState requestingRoute
    ) throws SimulationError {
        if (!this.group.equals(group)) {
            var delay = switchRef.groupChangeDelay;
            SwitchMoveEvent.plan(sim, sim.getTime() + delay, group, this, requestingRoute);
            setGroup(sim, SwitchGroup.MOVING);
        }
    }

    @Override
    public int getEnumValue() {
        int ordinal = 0;
        for (SwitchGroup g : switchRef.groups.keySet()) {
            if (g.equals(group)) {
                return ordinal;
            }
        }
        return -1;
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(RSValue other) {
        if (other.getClass() != SwitchState.class)
            return false;
        var o = (SwitchState) other;
        if (group == null)
            return o.group == null;
        return group.equals(o.group) && switchRef.equals(o.switchRef);
    }

    public static final class SwitchGroupChange extends EntityChange<SwitchState, Void> {
        SwitchGroup group;
        public final int switchIndex;

        protected SwitchGroupChange(Simulation sim, SwitchState entity, SwitchGroup group) {
            super(sim);
            this.group = group;
            this.switchIndex = entity.switchRef.switchIndex;
        }

        @Override
        public Void apply(Simulation sim, SwitchState entity) {
            entity.group = group;
            return null;
        }

        @Override
        public SwitchState getEntity(Simulation sim) {
            return sim.infraState.getSwitchState(switchIndex);
        }

        @Override
        public String toString() {
            return String.format("SwitchGroupChange { switch: %d, group: %s }", switchIndex, group);
        }
    }
}