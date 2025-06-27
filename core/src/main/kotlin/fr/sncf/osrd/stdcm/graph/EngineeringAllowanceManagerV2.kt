package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.PositionConstraint
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.pathfinding.PathfindingEdgeRangeId
import fr.sncf.osrd.utils.makePathProps
import fr.sncf.osrd.utils.units.Distance
import java.util.*

/**
 * This class contains all the methods used to handle allowances. This is how we add delays in
 * limited ranges of the path.
 */
class EngineeringAllowanceManagerV2(private val graph: STDCMGraph) {

    /**
     * Check whether an engineering allowance can be used in this context to be at the expected
     * start time at the node location. Returns the allowance length if it's possible, or null if it
     * isn't.
     */
    fun checkEngineeringAllowance(prevNode: STDCMNode, expectedStartTime: Double): Distance? {
        if (prevNode.previousEdge == null)
            return null // The conflict happens on the first block, we can't add delay here

        val edges = edgeToSequence(prevNode.previousEdge)

        var currentAddedTime = expectedStartTime - prevNode.timeData.earliestReachableTime
        var currentSpeed = prevNode.speed
        for (edge in edges) {

            val endTime = edge.timeData.earliestReachableTime + edge.totalTime
            val maxDelayAddedOnEdge = edge.timeData.timeOfNextConflictAtLocation - endTime
            if (currentAddedTime >= maxDelayAddedOnEdge) return null

            val (newBeginSpeed, newEdgeTime) = computeAcceleration(edge, currentSpeed)

            val timeDiffAtEdgeStart = newEdgeTime - edge.totalTime
            currentAddedTime -= timeDiffAtEdgeStart

            val slowdownExtraTime =
                getSlowdownExtraTime(edgeToSequence(edge).drop(1), newBeginSpeed)

            if (slowdownExtraTime >= currentAddedTime) {
                TODO("test that there's no conflict on the braking section")
                return TODO("identify allowance length")
            }
        }
        return null
    }

    private fun getSlowdownExtraTime(prevEdges: Sequence<STDCMEdge>, endSpeed: Double): Double {
        TODO()
    }

    private data class SummarizedSimulationResult(
        val newBeginSpeed: Double,
        val newEdgeTime: Double,
    )

    private fun computeAcceleration(edge: STDCMEdge, endSpeed: Double): SummarizedSimulationResult {
        val blockRange =
            PathfindingEdgeRangeId(
                edge.block,
                edge.envelopeStartOffset,
                edge.envelopeStartOffset + edge.length.distance
            )
        val simulationLength = (blockRange.end - blockRange.start).meters
        val routes = edge.infraExplorer.getExploredRoutes()
        val pathProperties =
            makePathProps(graph.rawInfra, graph.blockInfra, listOf(blockRange), routes)
        val mrsp = // TODO: use the cached version
            computeMRSP(
                pathProperties,
                graph.rollingStock,
                false,
                graph.tag,
                graph.temporarySpeedLimitManager,
            )
        val envelopePath = EnvelopeTrainPath.from(graph.rawInfra, pathProperties)
        val context = build(graph.rollingStock, envelopePath, graph.timeStep, graph.comfort)

        // Compute the speedup part to reach the end speed
        val speedupPartBuilder = EnvelopePartBuilder()
        speedupPartBuilder.setAttr(EnvelopeProfile.ACCELERATING)
        val overlayBuilder =
            ConstrainedEnvelopePartBuilder(
                speedupPartBuilder,
                SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
                PositionConstraint(0.0, simulationLength),
            )
        EnvelopeAcceleration.accelerate(context, simulationLength, endSpeed, overlayBuilder, -1.0)
        val speedupPart = speedupPartBuilder.build()
        val envelope = Envelope.make(speedupPart)

        val standardAllowanceSpeedRatio = graph.getStandardAllowanceSpeedRatio(envelope)
        val newTime = envelope.totalTime / standardAllowanceSpeedRatio

        return SummarizedSimulationResult(
            envelope.beginSpeed,
            newTime,
        )
    }
}

private fun edgeToSequence(edge: STDCMEdge?): Sequence<STDCMEdge> {
    // Lazily evaluated
    return generateSequence(edge) { it.previousNode.previousEdge }
}
