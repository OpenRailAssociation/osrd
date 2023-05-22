package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.stdcm.graph.STDCMEdgeBuilder.Companion.fromNode

/** This class contains all the methods used to backtrack in the graph.
 * We need to backtrack to remove any kind of speed discontinuity, generally because of deceleration spanning over
 * several edges.
 * <br></br>
 * A short explanation of how it's done: given nodes a, b, c, d
 * If we compute the edge "c->d" and see that we need to go slower at the start of the node (e.g. because we stop here)
 * We instantiate a new edge going from b to c, with the specified end speed. The predecessor of this new "b->c" edge
 * will be set to be the existing "a->b" edge (if we don't need to backtrack any further).
 * We can then create a new edge starting at c with the correct speed.
 */
class BacktrackingManager(private val graph: STDCMGraph) {
    /** Given an edge that needs an envelope change in previous edges to avoid a discontinuity,
     * returns an edge that has no discontinuity, going over the same route using the same opening.
     * The given edge does not change but the previous ones are new instances with a different envelope.
     * If no backtracking is needed, nothing is done and the edge is returned as it is.
     * If the new edge is invalid (for example if it would cause conflicts), returns null.  */
    fun backtrack(e: STDCMEdge): STDCMEdge? {
        if (e.previousNode == null) {
            // First edge of the path
            assert(e.envelope.beginSpeed == 0.0)
            return e
        }
        if (e.previousNode.speed == e.envelope.beginSpeed) {
            // No need to backtrack any further
            return e
        }

        // We try to create a new previous edge with the end speed we need
        val previousEdge = e.previousNode.previousEdge
        val newPreviousEdge = rebuildEdgeBackward(previousEdge, e.envelope.beginSpeed) ?: return null
        // No valid result was found

        // Create the new edge
        val newNode = newPreviousEdge.getEdgeEnd(graph)
        return fromNode(graph, newNode, e.route)
            .setStartOffset(e.envelopeStartOffset)
            .setEnvelope(e.envelope)
            .findEdgeSameNextOccupancy(e.timeNextOccupancy)
    }

    /** Recreate the edge, but with a different end speed. Returns null if no result is possible.
     *
     * The new edge will use the same physical path as the old one, but with a different envelope and times.
     * The train speed will be continuous from the start of the path,
     * recursive calls are made when needed (through the EdgeBuilder).
     * The start time and any data related to delays will be updated accordingly.
     */
    private fun rebuildEdgeBackward(old: STDCMEdge, endSpeed: Double): STDCMEdge? {
        val newEnvelope = simulateBackwards(
            old.route,
            endSpeed,
            old.envelopeStartOffset,
            old.envelope,
            graph
        )
        val prevNode = old.previousNode
        return STDCMEdgeBuilder(old.route, graph)
            .setStartTime(old.timeStart - old.addedDelay)
            .setStartOffset(old.envelopeStartOffset)
            .setPrevMaximumAddedDelay(old.maximumAddedDelayAfter + old.addedDelay)
            .setPrevAddedDelay(old.totalDepartureTimeShift - old.addedDelay)
            .setPrevNode(prevNode)
            .setEnvelope(newEnvelope)
            .setWaypointIndex(old.waypointIndex)
            .findEdgeSameNextOccupancy(old.timeNextOccupancy)
    }
}
