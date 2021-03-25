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

    /** Event value that represents train interacting with an action point */
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
    public static void plan(
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
        change.apply(sim, train);
        sim.publishChange(change);
    }

    public static class TrainPlannedMoveToActionPoint extends EntityChange<Train, Void> {
        public final double actionTime;
        public final String trainId;
        public final ActionPoint actionPoint;
        public final Train.TrainStateChange stateChange;
        public final TrainInteractionType interactionType;

        TrainPlannedMoveToActionPoint(
                Simulation sim,
                double actionTime,
                String trainId,
                ActionPoint actionPoint,
                Train.TrainStateChange stateChange,
                TrainInteractionType interactionType
        ) {
            super(sim);
            this.actionTime = actionTime;
            this.trainId = trainId;
            this.actionPoint = actionPoint;
            this.stateChange = stateChange;
            this.interactionType = interactionType;
        }

        @Override
        public Void apply(Simulation sim, Train train) {
            sim.scheduleEvent(new TrainReachesActionPoint(
                    sim.nextEventId(actionTime),
                    train,
                    actionPoint,
                    stateChange,
                    interactionType
            ));
            return null;
        }

        @Override
        public Train getEntity(Simulation sim) {
            return sim.trains.get(trainId);
        }
    }
}