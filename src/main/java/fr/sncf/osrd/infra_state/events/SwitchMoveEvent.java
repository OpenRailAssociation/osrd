package fr.sncf.osrd.infra_state.events;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra_state.RouteState;
import fr.sncf.osrd.infra_state.SwitchState;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.simulation.TimelineEventId;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SwitchMoveEvent extends TimelineEvent {
    static final Logger logger = LoggerFactory.getLogger(SwitchMoveEvent.class);
    private final String newGroup;
    private final SwitchState switchState;
    private final RouteState routeState;

    private SwitchMoveEvent(TimelineEventId eventId,
                            String newGroup,
                            SwitchState switchState,
                            RouteState routeState) {
        super(eventId);
        this.newGroup = newGroup;
        this.switchState = switchState;
        this.routeState = routeState;
    }

    @Override
    protected void onOccurrence(Simulation sim) throws SimulationError {
        switchState.setGroup(sim, newGroup);
        routeState.onSwitchMove(sim);
    }

    @Override
    protected void onCancellation(Simulation sim) throws SimulationError {
        throw new SimulationError("cancelling a switch move isn't supported");
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(TimelineEvent other) {
        if (other.getClass() != SwitchMoveEvent.class)
            return false;
        var o = (SwitchMoveEvent) other;
        return o.newGroup == newGroup && o.switchState.equals(switchState) && o.routeState.equals(routeState);
    }

    /** Plan a SwitchMoveEvent creating a change that schedule it */
    public static SwitchMoveEvent plan(Simulation sim,
                                       double moveTime,
                                       String newGroup,
                                       SwitchState switchState,
                                       RouteState routeState) {
        var change = new SwitchMovePlanned(sim, moveTime, newGroup, switchState, routeState);
        var event = change.apply(sim);
        sim.publishChange(change);
        return event;
    }

    public static class SwitchMovePlanned extends Simulation.TimelineEventCreated {

        private final String newGroup;
        private final SwitchState switchState;
        private final RouteState routeState;

        private SwitchMovePlanned(Simulation sim,
                                  double moveTime,
                                  String newGroup,
                                  SwitchState switchState,
                                  RouteState routeState) {
            super(sim, moveTime);
            this.newGroup = newGroup;
            this.switchState = switchState;
            this.routeState = routeState;
        }

        private SwitchMoveEvent apply(Simulation sim) {
            var event = new SwitchMoveEvent(eventId, newGroup, switchState, routeState);
            super.scheduleEvent(sim, event);
            return event;
        }

        @Override
        public void replay(Simulation sim) {
            apply(sim);
        }

        @Override
        public String toString() {
            return String.format("SwitchChangePlanned { newGroup=%s, switchId=%s }",
                    newGroup, switchState.switchRef.id);
        }
    }
}
