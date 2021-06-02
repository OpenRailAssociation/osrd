package fr.sncf.osrd.infra.signaling;

import fr.sncf.osrd.infra.railscript.*;
import fr.sncf.osrd.infra.railscript.value.RSAspectSet;
import fr.sncf.osrd.infra_state.InfraState;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.InteractionTypeSet;
import fr.sncf.osrd.utils.graph.ApplicableDirection;

import java.util.ArrayList;

public class Signal implements ActionPoint {
    public final int index;
    public final double sightDistance;
    public final String id;
    public final RSStatefulExpr<RSAspectSet> expr;
    public final ArrayList<Signal> signalSubscribers = new ArrayList<>();
    public final ApplicableDirection direction;

    private RSAspectSet initialAspects = new RSAspectSet();
    private static final InteractionTypeSet interactionTypeSet =
            new InteractionTypeSet(new InteractionType[]{InteractionType.HEAD, InteractionType.SEEN});

    /** The static data describing a signal */
    public Signal(
            int index,
            String id,
            RSStatefulExpr<RSAspectSet> expr,
            ApplicableDirection direction,
            double sightDistance
    ) {
        this.index = index;
        this.id = id;
        this.expr = expr;
        this.direction = direction;
        this.sightDistance = sightDistance;
    }

    public void evalInitialAspect(InfraState initialState) {
        initialAspects = initialState.getSignalState(index).exprState.evalInit(initialState);
    }

    @Override
    public InteractionTypeSet getInteractionsType() {
        return interactionTypeSet;
    }

    @Override
    public double getActionDistance() {
        return sightDistance;
    }

    @Override
    public void interact(Simulation sim, Train train, InteractionType interactionType) throws SimulationError {
        train.interact(sim, this, interactionType);
    }

    public RSAspectSet getInitialAspects() {
        return initialAspects;
    }

    @Override
    public String toString() {
        return String.format("Signal { id=%s }", id);
    }
}
