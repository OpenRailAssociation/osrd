package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.graph.PathfindingEdgeRangeId
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.sumDistances
import java.util.*

/**
 * This class contains all the methods used to handle allowances. This is how we add delays in
 * limited ranges of the path.
 */
class EngineeringAllowanceManager(private val graph: STDCMGraph) {

    /**
     * Check whether an engineering allowance can be used in this context to be at the expected
     * start time at the node location.
     */
    fun checkEngineeringAllowance(prevNode: STDCMNode, expectedStartTime: Double): Boolean {
        if (prevNode.previousEdge == null)
            return false // The conflict happens on the first block, we can't add delay here
        val affectedEdges =
            findAffectedEdges(
                prevNode.previousEdge,
                expectedStartTime - prevNode.timeData.earliestReachableTime
            )
        if (affectedEdges.isEmpty()) return false // No space to try the allowance

        val length = affectedEdges.map { it.length.distance }.sumDistances()
        if (length > 20_000.meters) {
            // If the allowance area is large enough to reasonably stop and accelerate again, we
            // just accept the solution. This avoids computation on very large paths
            // (which can be quite time expensive)
            return true
        }
        if (length == 0.meters) return false

        // We try to run a simulation with the slowest running time while keeping the end time
        // identical.
        // This give a very accurate response, but it's quite computationally expensive
        // and not compatible with the future running time interfaces.
        // Eventually we'll use better heuristics, but this is fine as part of the refactor
        // to remove envelopes in STDCM edges (we used to actually compute the allowance envelopes
        // here).
        val slowestRunningTime = getSlowestRunningTime(affectedEdges)
        val firstNode = affectedEdges.first()
        val latestArrivalTime =
            firstNode.timeData.earliestReachableTime +
                firstNode.timeData.maxDepartureDelayingWithoutConflict +
                slowestRunningTime
        return latestArrivalTime >= expectedStartTime
    }

    /**
     * Returns the maximum time the train can use to run over the given edges, while keeping the
     * same begin/end speed. This is implemented using ad-hoc running time calls and isn't very
     * "clean", but it is not meant to stay that way, we should eventually use heuristics instead of
     * actual simulations.
     */
    private fun getSlowestRunningTime(edges: List<STDCMEdge>): Double {
        val beginSpeed = edges.first().beginSpeed
        val endSpeed = edges.last().endSpeed
        val blockRanges =
            edges.map {
                PathfindingEdgeRangeId(
                    it.block,
                    it.envelopeStartOffset,
                    it.envelopeStartOffset + it.length.distance
                )
            }
        val routes = edges.last().infraExplorer.getExploredRoutes()
        val pathProperties = makePathProps(graph.rawInfra, graph.blockInfra, blockRanges, routes)
        val mrsp = computeMRSP(pathProperties, graph.rollingStock, false, graph.tag)
        val envelopePath = EnvelopeTrainPath.from(graph.rawInfra, pathProperties)
        val context = build(graph.rollingStock, envelopePath, graph.timeStep, graph.comfort)
        try {
            val maxSpeedEnvelope = MaxSpeedEnvelope.from(context, DoubleArray(0), mrsp)
            val maxEffort = MaxEffortEnvelope.from(context, beginSpeed, maxSpeedEnvelope)
            if (maxEffort.none { it.hasAttr(EnvelopeProfile.CONSTANT_SPEED) }) {
                return 0.0 // When no constant speed part, there can't be any allowance
            }
            if (beginSpeed == 0.0 || endSpeed == 0.0) return Double.POSITIVE_INFINITY

            val speedupPartBuilder = EnvelopePartBuilder()
            speedupPartBuilder.setAttr(EnvelopeProfile.ACCELERATING)
            val overlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    speedupPartBuilder,
                    SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
                    EnvelopeConstraint(maxEffort, EnvelopePartConstraintType.CEILING)
                )
            EnvelopeAcceleration.accelerate(
                context,
                maxEffort.endPos,
                endSpeed,
                overlayBuilder,
                -1.0
            )
            val builder = OverlayEnvelopeBuilder.backward(maxEffort)
            if (speedupPartBuilder.stepCount() > 1) builder.addPart(speedupPartBuilder.build())
            val withSpeedup = builder.build()

            val slowdownPartBuilder = EnvelopePartBuilder()
            slowdownPartBuilder.setAttr(EnvelopeProfile.BRAKING)
            val slowdownOverlayBuilder =
                ConstrainedEnvelopePartBuilder(
                    slowdownPartBuilder,
                    SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
                    EnvelopeConstraint(withSpeedup, EnvelopePartConstraintType.FLOOR)
                )
            EnvelopeDeceleration.decelerate(context, 0.0, beginSpeed, slowdownOverlayBuilder, 1.0)
            val slowdownBuilder = OverlayEnvelopeBuilder.backward(withSpeedup)
            if (slowdownPartBuilder.stepCount() > 1)
                slowdownBuilder.addPart(slowdownPartBuilder.build())
            val slowestEnvelope = slowdownBuilder.build()
            if (slowestEnvelope.minSpeed == 0.0) return Double.POSITIVE_INFINITY
            return slowestEnvelope.totalTime
        } catch (e: OSRDError) {
            return 0.0
        }
    }

    /**
     * Find on which edges to run the allowance. When we need to add x seconds of delay, we go
     * backwards and add any edge until one has less than x seconds of "free space" after it. This
     * is a little pessimistic, but not by much.
     */
    private fun findAffectedEdges(edge: STDCMEdge, delayNeeded: Double): List<STDCMEdge> {
        var mutEdge = edge
        var mutDelayNeeded = delayNeeded
        val res = ArrayDeque<STDCMEdge>()
        while (true) {
            if (mutEdge.endAtStop) {
                // Engineering allowances can't span over stops
                return ArrayList(res)
            }
            val endTime = mutEdge.timeData.earliestReachableTime + mutEdge.totalTime
            val maxDelayAddedOnEdge = mutEdge.timeData.timeOfNextConflictAtLocation - endTime
            if (mutDelayNeeded > maxDelayAddedOnEdge) {
                // We can't add delay in this block, the allowance range ends here (excluded)
                return ArrayList(res)
            }
            res.addFirst(mutEdge)
            if (mutEdge.previousNode.previousEdge == null) {
                // We've reached the start of the path, this should only happen because of the max
                // delay parameter
                return ArrayList(res)
            }
            mutDelayNeeded += mutEdge.timeData.delayAddedToLastDeparture
            mutEdge = mutEdge.previousNode.previousEdge!!
        }
    }
}
