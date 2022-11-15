package fr.sncf.osrd.api.stdcm.graph;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;

import fr.sncf.osrd.api.stdcm.BacktrackingEnvelopeAttr;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import java.util.List;

/** This class contains all the methods used to backtrack in the graph.
 * We need to backtrack to remove any kind of speed discontinuity, generally because of deceleration spanning over
 * several edges.
 * </p>
 * A short explanation of how it's done: given nodes a, b, c, d
 * If we compute the edge "c->d" and see that we need to go slower at the start of the node (e.g. because we stop here)
 * We instantiate a new edge going from b to c, with the specified end speed. The predecessor of this new "b->c" edge
 * will be set to be the existing "a->b" edge (if we don't need to backtrack any further).
 * We can then create a new edge starting at c with the correct speed.
 * */
public class BacktrackingManager {

    private final STDCMGraph graph;

    public BacktrackingManager(STDCMGraph graph) {
        this.graph = graph;
    }

    /** Given an edge that needs an envelope change in previous edges to avoid a discontinuity,
     * returns an edge that has no discontinuity, going over the same route using the same opening.
     * The given edge does not change but the previous ones are new instances with a different envelope.
     * If no backtracking is needed, nothing is done and the edge is returned as it is.
     * If the new edge is invalid (for example if it would cause conflicts), returns null. */
    STDCMEdge backtrack(STDCMEdge e) {
        if (e.previousNode() == null) {
            // First edge of the path
            assert e.envelope().getBeginSpeed() == 0;
            return e;
        }
        if (e.previousNode().speed() == e.envelope().getBeginSpeed()) {
            // No need to backtrack any further
            return e;
        }

        // We try to create a new previous edge with the end speed we need
        var previousEdge = e.previousNode().previousEdge();
        var newPreviousEdge = rebuildEdgeBackward(previousEdge, e.envelope().getBeginSpeed());
        if (newPreviousEdge == null)
            return null; // No valid result was found

        // Create the new edge
        var newNode = newPreviousEdge.getEdgeEnd(graph);
        if (newNode == null)
            return null;
        return STDCMEdgeBuilder.fromNode(graph, newNode, e.route())
                .setStartOffset(e.envelopeStartOffset())
                .setEnvelope(e.envelope())
                .findEdgeSameNextOccupancy(e.timeNextOccupancy());
    }

    /** Recreate the edge, but with a different end speed. Returns null if no result is possible.
     * </p>
     * The new edge will use the same physical path as the old one, but with a different envelope and times.
     * The train speed will be continuous from the start of the path,
     * recursive calls are made when needed (through the EdgeBuilder).
     * The start time and any data related to delays will be updated accordingly.
     * */
    private STDCMEdge rebuildEdgeBackward(STDCMEdge old, double endSpeed) {
        var newEnvelope = simulateBackwards(old.route(), endSpeed, old.envelopeStartOffset(), old.envelope());
        var prevNode = old.previousNode();
        return new STDCMEdgeBuilder(old.route(), graph)
                .setStartTime(old.timeStart() - old.addedDelay())
                .setStartOffset(old.envelopeStartOffset())
                .setPrevMaximumAddedDelay(old.maximumAddedDelayAfter() + old.addedDelay())
                .setPrevAddedDelay(old.totalDepartureTimeShift() - old.addedDelay())
                .setPrevNode(prevNode)
                .setEnvelope(newEnvelope)
                .findEdgeSameNextOccupancy(old.timeNextOccupancy());
    }

    /** Simulates a route that already has an envelope, but with a different end speed */
    private Envelope simulateBackwards(
            SignalingRoute route,
            double endSpeed,
            double start,
            Envelope oldEnvelope
    ) {
        var context = STDCMUtils.makeSimContext(
                List.of(route),
                start,
                graph.rollingStock,
                graph.timeStep
        );
        var partBuilder = new EnvelopePartBuilder();
        partBuilder.setAttr(EnvelopeProfile.BRAKING);
        partBuilder.setAttr(new BacktrackingEnvelopeAttr());
        var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                partBuilder,
                new SpeedConstraint(0, FLOOR),
                new EnvelopeConstraint(oldEnvelope, CEILING)
        );
        EnvelopeDeceleration.decelerate(
                context,
                oldEnvelope.getEndPos(),
                endSpeed,
                overlayBuilder,
                -1
        );
        var builder = OverlayEnvelopeBuilder.backward(oldEnvelope);
        builder.addPart(partBuilder.build());
        return builder.build();
    }
}
