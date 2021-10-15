package fr.sncf.osrd.train.events;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.StopActionPoint;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.simulation.TimelineEventId;
import fr.sncf.osrd.train.Interaction;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainEvolutionEvent;

/** This event represents a train's interaction with an action point. */
public final class TrainReachesActionPoint extends TrainEvolutionEvent {
    public final Train train;
    public final Train.TrainStateChange trainStateChange;
    public final Interaction interaction;

    /** Create a train reaches action point */
    private TrainReachesActionPoint(
            TimelineEventId eventId,
            Train train,
            Train.TrainStateChange trainStateChange,
            Interaction interaction
    ) {
        super(eventId);
        assert train != null : "missing train";
        this.train = train;
        assert trainStateChange != null : "missing trainStateChange";
        this.trainStateChange = trainStateChange;
        assert interaction != null : "missing interaction";
        this.interaction = interaction;
    }

    @Override
    protected void onOccurrence(Simulation sim) throws SimulationError {
        // Apply StateChange
        var stateChange = trainStateChange;
        stateChange.apply(sim, train);
        sim.publishChange(stateChange);

        // Interact
        interaction.interact(sim, train);

        // Notify train that an event occurred
        train.onEventOccurred(sim);

        // Schedule next state
        if (!(interaction.actionPoint instanceof StopActionPoint))
            train.scheduleStateChange(sim);
    }

    @Override
    protected void onCancellation(Simulation sim) {}

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(TimelineEvent other) {
        if (other.getClass() != TrainReachesActionPoint.class)
            return false;
        var o = (TrainReachesActionPoint) other;
        return o.train.getID().equals(train.getID())
                && o.trainStateChange.deepEquals(trainStateChange)
                && o.interaction.deepEquals(interaction);
    }

    /** Plan a move to an action point */
    public static TrainReachesActionPoint plan(
            Simulation sim,
            double actionTime,
            Train train,
            Train.TrainStateChange trainStateChange,
            Interaction interaction
    ) {
        var change = new TrainPlannedMoveToActionPoint(
                sim, actionTime, train.getID(), trainStateChange, interaction
        );
        var event = change.apply(sim, train);
        sim.publishChange(change);
        return event;
    }

    @Override
    public Double interpolatePosition(double time) {
        assert this.trainStateChange != null : "missing trainStateChange";
        return trainStateChange.interpolatePosition(time);
    }

    public static class TrainPlannedMoveToActionPoint extends Simulation.TimelineEventCreated {
        public final String trainId;
        public final Train.TrainStateChange stateChange;
        public final Interaction interaction;

        private TrainPlannedMoveToActionPoint(
                Simulation sim,
                double actionTime,
                String trainId,
                Train.TrainStateChange stateChange,
                Interaction interaction
        ) {
            super(sim, actionTime);
            this.trainId = trainId;
            this.stateChange = stateChange;
            this.interaction = interaction;
        }

        private TrainReachesActionPoint apply(Simulation sim, Train train) {
            var event = new TrainReachesActionPoint(
                    eventId,
                    train,
                    stateChange,
                    interaction
            );
            super.scheduleEvent(sim, event);
            return event;
        }

        @Override
        public void replay(Simulation sim) {
            apply(sim, sim.trains.get(trainId));
        }

        @Override
        public String toString() {
            return String.format(
                    "TrainPlannedMoveToActionPoint { eventId=%s, trainId=%s, actionPoint=%s, interactsWith=%s }",
                    eventId, trainId, interaction.actionPoint, interaction.interactionType.name()
            );
        }
    }

    @Override
    public String toString() {
        return String.format(
                "TrainReachesActionPoint { eventId=%s, trainId=%s, actionPoint=%s, interactsWith=%s }",
                eventId, trainStateChange.trainID, interaction.actionPoint, interaction.interactionType.name()
        );
    }
}