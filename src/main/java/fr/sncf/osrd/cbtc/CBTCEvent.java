package fr.sncf.osrd.cbtc;

import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.simulation.TimelineEventId;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainStatus;

public class CBTCEvent extends TimelineEvent {

    private final Train train;

    public CBTCEvent(TimelineEventId eventId, Train train) {
        super(eventId);
        this.train = train;
    }

    public static CBTCEvent plan(Simulation sim, double scheduledTime, Train train) {
        var change = new CBTCEventPlanned(sim, scheduledTime, train);
        var event = change.apply(sim);
        sim.publishChange(change);
        return event;
    }

    @Override
    protected void onOccurrence(Simulation sim) throws SimulationError {
        train.scheduleStateChange(sim);
        // Create next event if the train speed is not null ???
        // System.out.println(train.getLastState().status);
        // if(train.getLastState().status != TrainStatus.REACHED_DESTINATION && train.getLastState().status != TrainStatus.STOP){
        //     System.out.println("CBTC Event occured");
        //     var simulationResult = train.getLastState().evolveStateUntilNow(sim);
        //     plan(sim, sim.getTime()+0.2, train);
        // }
    }

    @Override
    protected void onCancellation(Simulation sim) throws SimulationError {
    }

    @Override
    public boolean deepEquals(TimelineEvent other) {
        if (!(other instanceof CBTCEvent))
            return false;
        boolean sameTrain = (train == ((CBTCEvent) other).train);
        boolean sameScheduledTime = (eventId.scheduledTime == other.eventId.scheduledTime);
        return sameTrain && sameScheduledTime;
    }

    public static class CBTCEventPlanned extends Simulation.TimelineEventCreated {

        private final Train train;

        protected CBTCEventPlanned(Simulation sim, double scheduledTime, Train train) {
            super(sim, scheduledTime);
            this.train = train;
        }

        private CBTCEvent apply(Simulation sim) {
            CBTCEvent event = new CBTCEvent(eventId, train);
            super.scheduleEvent(sim, event);
            return event;
        }

        @Override
        public void replay(Simulation sim) {
            apply(sim);
        }

        @Override
        public String toString() {
            return String.format("CBTCEventPlanned { trainId=%s - scheduledTime=%f}", train.getName(), eventId.scheduledTime);
        }
    }
}
