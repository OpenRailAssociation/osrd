package fr.sncf.osrd.train;

import fr.sncf.osrd.simulation.TimelineEvent;
import fr.sncf.osrd.simulation.TimelineEventId;

public abstract class TrainEvolutionEvent extends TimelineEvent {
    public TrainEvolutionEvent(TimelineEventId eventId) {
        super(eventId);
    }

    public abstract double interpolatePosition(double time);
}
