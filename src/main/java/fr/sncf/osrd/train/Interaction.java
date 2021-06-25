package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.utils.DeepComparable;

import java.util.Objects;

public final class Interaction implements DeepComparable<Interaction>, Comparable<Interaction> {
    public final InteractionType interactionType;
    public double position;
    public final ActionPoint actionPoint;

    /** Create an interaction */
    public Interaction(InteractionType interactionType, double position, ActionPoint actionPoint) {
        this.interactionType = interactionType;
        this.position = position;
        this.actionPoint = actionPoint;
    }

    public void interact(Simulation sim, Train train) throws SimulationError {
        actionPoint.interact(sim, train, interactionType);
    }

    @Override
    @SuppressFBWarnings(
            value = "FE_FLOATING_POINT_EQUALITY",
            justification = "there is no need for tolerance here for now"
    )
    public boolean deepEquals(Interaction o) {
        return o.actionPoint == actionPoint && o.interactionType == interactionType && o.position == position;
    }

    @Override
    @SuppressFBWarnings(
            value = "FE_FLOATING_POINT_EQUALITY",
            justification = "there is no need for tolerance here for now"
    )
    public int compareTo(Interaction o) {
        if (o.position == position && o.interactionType == InteractionType.SEEN)
            return -1;
        return Double.compare(position, o.position);
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null || obj.getClass() != Interaction.class)
            return false;
        var o = (Interaction) obj;
        return deepEquals(o);
    }

    @Override
    public int hashCode() {
        return Objects.hash(position, interactionType, actionPoint);
    }
}
