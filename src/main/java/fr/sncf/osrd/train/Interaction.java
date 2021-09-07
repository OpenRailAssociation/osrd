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

    /** Compare two interactions
     * Returns < 0 if this is placed before the other Interaction, so that the interaction list can be .sorted() */
    public int compareTo(Interaction o) {
        if (Math.abs(o.position - position) < 1e-5)
            // For the same position, we need to consider SEEN interaction first
            return interactionType.compareTo(o.interactionType);
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

    @Override
    public String toString() {
        return String.format("Interaction { type=%s, position=%f, point=%s }", interactionType, position, actionPoint);
    }
}
