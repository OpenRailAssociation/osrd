package fr.sncf.osrd.train.events;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.TrainInteractionType;

public final class TrainReachesActionPoint extends TimelineEvent {
    public final Train train;
    public final ActionPoint actionPoint;
    public final Train.TrainStateChange trainStateChange;
    public final TrainInteractionType interactionType;

    /** Event that represents a train's interaction with an action point */
    private TrainReachesActionPoint(
            TimelineEventId eventId,
            Train train,
            ActionPoint actionPoint,
            Train.TrainStateChange trainStateChange,
            TrainInteractionType interactionType
    ) {
        super(eventId);
        this.train = train;
        this.actionPoint = actionPoint;
        this.trainStateChange = trainStateChange;
        this.interactionType = interactionType;
    }

    @Override
    protected void onOccurrence(Simulation sim) throws SimulationError {
        // Apply StateChange
        var stateChange = trainStateChange;
        stateChange.apply(sim, train);
        sim.publishChange(stateChange);

        // Interact
        actionPoint.interact(sim, train, interactionType);

        train.onEventOccurred(sim);

        // Schedule next state
        train.scheduleStateChange(sim);
    }

    @Override
    protected void onCancellation(Simulation sim) throws SimulationError {
        throw new SimulationError("TrainReachesActionPoint cancellation not implemented");
    }

    @Override
    @SuppressFBWarnings({"BC_UNCONFIRMED_CAST"})
    public boolean deepEquals(TimelineEvent other) {
        if (other.getClass() != TrainReachesActionPoint.class)
            return false;
        var o = (TrainReachesActionPoint) other;
        return o.train.getName().equals(train.getName())
                && o.actionPoint == actionPoint
                && o.trainStateChange.deepEquals(trainStateChange)
                && o.interactionType == interactionType;
    }

    /** Plan a move to an action point */
    public static TrainReachesActionPoint plan(
            Simulation sim,
            double actionTime,
            Train train,
            ActionPoint actionPoint,
            Train.TrainStateChange trainStateChange,
            TrainInteractionType interactionType
    ) {
        var change = new TrainPlannedMoveToActionPoint(
                sim, actionTime, train.getName(), actionPoint, trainStateChange, interactionType
        );
        var event = change.apply(sim, train);
        sim.publishChange(change);
        return event;
    }

    public static class TrainPlannedMoveToActionPoint extends Simulation.TimelineEventCreated {
        public final String trainId;
        public final ActionPoint actionPoint;
        public final Train.TrainStateChange stateChange;
        public final TrainInteractionType interactionType;

        private TrainPlannedMoveToActionPoint(
                Simulation sim,
                double actionTime,
                String trainId,
                ActionPoint actionPoint,
                Train.TrainStateChange stateChange,
                TrainInteractionType interactionType
        ) {
            super(sim, actionTime);
            this.trainId = trainId;
            this.actionPoint = actionPoint;
            this.stateChange = stateChange;
            this.interactionType = interactionType;
        }

        private TrainReachesActionPoint apply(Simulation sim, Train train) {
            var event = new TrainReachesActionPoint(
                    eventId,
                    train,
                    actionPoint,
                    stateChange,
                    interactionType
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
                    eventId, trainId, actionPoint, interactionType.name()
            );
        }
    }
}