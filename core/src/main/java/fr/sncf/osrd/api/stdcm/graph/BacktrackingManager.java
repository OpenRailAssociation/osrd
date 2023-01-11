package fr.sncf.osrd.api.stdcm.graph;

/** This class contains all the methods used to backtrack in the graph.
 * We need to backtrack to remove any kind of speed discontinuity, generally because of deceleration spanning over
 * several edges.
 * <br/>
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
        var newEnvelope = STDCMSimulations.simulateBackwards(
                old.route(),
                endSpeed,
                old.envelopeStartOffset(),
                old.envelope(),
                graph
        );
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

}
