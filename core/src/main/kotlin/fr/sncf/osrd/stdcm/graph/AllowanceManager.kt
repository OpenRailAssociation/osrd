package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters
import java.util.*

/** This class contains all the methods used to handle allowances.
 * This is how we add delays in limited ranges of the path.
 */
class AllowanceManager(private val graph: STDCMGraph) {
    /** Try to run an engineering allowance on the blocks leading to the given edge. Returns null if it failed.  */
    fun tryEngineeringAllowance(
        oldEdge: STDCMEdge
    ): STDCMEdge? {
        val neededDelay = getNeededDelay(oldEdge)
        if (oldEdge.previousNode == null)
            return null // The conflict happens on the first block, we can't add delay here
        val affectedEdges = findAffectedEdges(
            oldEdge.previousNode.previousEdge,
            oldEdge.addedDelay
        )
        if (affectedEdges.isEmpty())
            return null // No space to try the allowance
        val context = makeAllowanceContext(affectedEdges)
        val oldEnvelope = mergeEnvelopes(graph, affectedEdges, context)
        val newEnvelope = findEngineeringAllowance(context, oldEnvelope, neededDelay)
            ?: return null
        // We couldn't find an envelope
        val newPreviousEdge = makeNewEdges(affectedEdges, newEnvelope)
            ?: return null
        // The new edges are invalid, conflicts shouldn't happen here but it can be too slow
        val newPreviousNode = newPreviousEdge.getEdgeEnd(graph)
        return STDCMEdgeBuilder.fromNode(graph, newPreviousNode, oldEdge.block)
            .findEdgeSameNextOccupancy(oldEdge.timeNextOccupancy)
    }

    /** Computes the delay we need to add  */
    private fun getNeededDelay(oldEdge: STDCMEdge): Double {
        val neededDelay = -oldEdge.maximumAddedDelayAfter
        assert(neededDelay > 0)
        val targetRunTime = oldEdge.totalTime + neededDelay

        // As the standard allowance is first applied as a linear allowance over the whole path,
        // we need to compensate it by going faster here
        val targetRunTimePreStandardAllowance = targetRunTime * oldEdge.standardAllowanceSpeedFactor
        return targetRunTimePreStandardAllowance - oldEdge.envelope.totalTime
    }

    /** Re-create the edges in order, following the given envelope.  */
    private fun makeNewEdges(edges: List<STDCMEdge>, totalEnvelope: Envelope): STDCMEdge? {
        var previousEnd = 0.0
        var prevEdge: STDCMEdge? = null
        if (edges[0].previousNode != null)
            prevEdge = edges[0].previousNode!!.previousEdge
        for (edge in edges) {
            var end = previousEnd + edge.envelope.endPos
            end = findClosestPartTransition(end, totalEnvelope)
            val node = prevEdge?.getEdgeEnd(graph)
            var maxAddedDelayAfter = edge.maximumAddedDelayAfter + edge.addedDelay
            if (node != null)
                maxAddedDelayAfter = node.maximumAddedDelay
            prevEdge = STDCMEdgeBuilder(edge.block, graph)
                .setStartTime(node?.time ?: edge.timeStart)
                .setStartSpeed(edge.envelope.beginSpeed)
                .setStartOffset(edge.envelopeStartOffset)
                .setPrevMaximumAddedDelay(maxAddedDelayAfter)
                .setPrevAddedDelay(node?.totalPrevAddedDelay ?: 0.0)
                .setPrevNode(node)
                .setEnvelope(extractEnvelopeSection(totalEnvelope, previousEnd, end))
                .setForceMaxDelay(true)
                .setWaypointIndex(edge.waypointIndex)
                .findEdgeSameNextOccupancy(edge.timeNextOccupancy)
            if (prevEdge == null)
                return null
            previousEnd = end
        }
        assert(TrainPhysicsIntegrator.arePositionsEqual(previousEnd, totalEnvelope.endPos))
        return prevEdge
    }

    /** The position can be an epsilon away from a range transition, which would create an epsilon-length envelope
     * part, which may eventually cause further issues  */
    private fun findClosestPartTransition(offset: Double, envelope: Envelope): Double {
        for (part in envelope) {
            if (TrainPhysicsIntegrator.arePositionsEqual(offset, part.beginPos))
                return part.beginPos
            if (TrainPhysicsIntegrator.arePositionsEqual(offset, part.endPos))
                return part.endPos
        }
        return offset
    }

    /** Creates the EnvelopeSimContext to run an allowance on the given edges  */
    private fun makeAllowanceContext(edges: List<STDCMEdge>): EnvelopeSimContext {
        val blocks = ArrayList<BlockId>()
        val firstOffset = (graph.blockInfra.getBlockLength(edges[0].block)
                - fromMeters(edges[0].envelope.endPos))
        for (edge in edges)
            blocks.add(edge.block)
        return makeSimContext(
            graph.rawInfra, graph.blockInfra, blocks, firstOffset,
            graph.rollingStock, graph.comfort, graph.timeStep
        )
    }

    /** Find on which edges to run the allowance  */
    private fun findAffectedEdges(edge: STDCMEdge, delayNeeded: Double): List<STDCMEdge> {
        var mutEdge = edge
        var mutDelayNeeded = delayNeeded
        val res = ArrayDeque<STDCMEdge>()
        while (true) {
            if (mutEdge.endAtStop) {
                // Engineering allowances can't span over stops
                return ArrayList(res)
            }
            val endTime = mutEdge.timeStart + mutEdge.totalTime
            val maxDelayAddedOnEdge = mutEdge.timeNextOccupancy - endTime
            if (mutDelayNeeded > maxDelayAddedOnEdge) {
                // We can't add delay in this block, the allowance range ends here (excluded)
                return ArrayList(res)
            }
            res.addFirst(mutEdge)
            if (mutEdge.previousNode == null) {
                // We've reached the start of the path, this should only happen because of the max delay parameter
                return ArrayList(res)
            }
            mutDelayNeeded += mutEdge.addedDelay
            mutEdge = mutEdge.previousNode!!.previousEdge
        }
    }
}

/** Returns a new envelope with the content of the base envelope from start to end, with 0 as first position  */
private fun extractEnvelopeSection(base: Envelope, start: Double, end: Double): Envelope {
    val parts = base.slice(start, end)
    for (i in parts.indices)
        parts[i] = parts[i].copyAndShift(-start, 0.0, end - start)
    return Envelope.make(*parts)
}
