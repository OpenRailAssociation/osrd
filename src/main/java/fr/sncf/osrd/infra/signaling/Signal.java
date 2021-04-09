package fr.sncf.osrd.infra.signaling;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.infra.railscript.*;
import fr.sncf.osrd.infra.railscript.value.RSAspectSet;
import fr.sncf.osrd.infra_state.InfraState;
import fr.sncf.osrd.simulation.*;
import fr.sncf.osrd.train.InteractionType;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.train.InteractionsType;
import fr.sncf.osrd.utils.graph.ApplicableDirections;

import java.util.ArrayList;

@SuppressFBWarnings({"URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD"})
public class Signal implements ActionPoint {
    public final int index;
    public final String id;
    public final RSStatefulExpr<RSAspectSet> expr;
    public final ArrayList<Signal> signalSubscribers = new ArrayList<>();
    public final ApplicableDirections direction;

    private RSAspectSet initialAspects = new RSAspectSet();
    private static final InteractionsType interactionsType =
            new InteractionsType(new InteractionType[]{InteractionType.HEAD, InteractionType.TAIL});

    /** The static data describing a signal */
    public Signal(
            int index,
            String id,
            RSStatefulExpr<RSAspectSet> expr,
            ApplicableDirections direction
    ) {
        this.index = index;
        this.id = id;
        this.expr = expr;
        this.direction = direction;
    }

    public void evalInitialAspect(InfraState initialState) {
        initialAspects = initialState.getSignalState(index).exprState.evalInit(initialState);
    }

    @Override
    public InteractionsType getInteractionsType() {
        return interactionsType;
    }

    @Override
    public double getActionDistance() {
        // TODO shouldn't be 0 but the signal sight distance
        return 0;
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

    public static class DependenciesFinder extends RSExprVisitor {
        final Signal signal;

        public DependenciesFinder(Signal signal) {
            this.signal = signal;
        }

        @Override
        public void visit(RSExpr.SignalRef expr) throws InvalidInfraException {
            expr.signal.signalSubscribers.add(signal);
            super.visit(expr);
        }

        @Override
        public void visit(RSExpr.RouteRef expr) throws InvalidInfraException {
            expr.route.signalSubscribers.add(signal);
            super.visit(expr);
        }

        @Override
        public void visit(RSExpr.SwitchRef expr) throws InvalidInfraException {
            expr.switchRef.signalSubscribers.add(signal);
            super.visit(expr);
        }
    }
}
