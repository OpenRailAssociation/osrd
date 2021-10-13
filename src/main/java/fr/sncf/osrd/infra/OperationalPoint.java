package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.signaling.ActionPoint;
import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.simulation.OperationalPointChange;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.InteractionTypeSet;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.utils.PointSequence;
import java.util.ArrayList;

public final class OperationalPoint implements ActionPoint {
    public final String id;
    public final transient ArrayList<TrackSection> refs = new ArrayList<>();

    public OperationalPoint(String id) {
        this.id = id;
    }

    /**
     * Add a reference to an operational point into a track section
     * @param section the track section to reference the op from
     * @param position the position of the operational point section
     * @param opBuilder Builder for sequence of operational point, to add the point in it
     */
    public void addRef(TrackSection section, double position, PointSequence.Builder<OperationalPoint> opBuilder) {
        this.refs.add(section);
        opBuilder.add(position, this);
    }

    @Override
    public InteractionTypeSet getInteractionsType() {
        return new InteractionTypeSet(new InteractionType[]{InteractionType.HEAD});
    }

    @Override
    public double getSightDistance() {
        return 0;
    }

    @Override
    public void interact(Simulation sim, Train train, InteractionType interactionType) {
        var change = new OperationalPointChange(sim, train, this);
        sim.publishChange(change);
    }

    @Override
    public String toString() {
        return String.format("OperationalPoint {%s}", id);
    }
}
