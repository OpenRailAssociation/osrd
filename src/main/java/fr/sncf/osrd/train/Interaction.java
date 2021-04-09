package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.utils.DeepComparable;

public class Interaction implements DeepComparable<Interaction> {
    public final InteractionType interactionType;
    public final double position;
    public final ActionPoint actionPoint;

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
}
