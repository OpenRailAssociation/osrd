package fr.sncf.osrd.stdcm.graph.engineering_allowance

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.PositionConstraint
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.electrification.Electrification
import fr.sncf.osrd.envelope_sim.electrification.Electrified
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeAcceleration
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.sim_infra.api.PathProperties
import fr.sncf.osrd.stdcm.graph.STDCMEdge
import fr.sncf.osrd.stdcm.graph.STDCMGraph
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters

/**
 * Simplified segment of past simulation, on which we try to overlay a braking + acceleration
 * sequence. Built from (pieces of) stdcm edges, or generated for unit tests.
 */
data class SimulationSegment(
    val beginTime: Double,
    val length: Distance,
    val beginSpeed: Double,
    val travelTime: Double,
    val maxAddedDelay: Double,
    // Function to compute an acceleration over this segment. Can be dummy values for tests,
    // wrap a full simulation pipeline in normal processing.
    val computeAccelSequenceFromEndSpeed: (Double) -> SummarizedSimulationResult,
    val minAllowanceBefore: Double = 0.0,
) {
    init {
        positive(beginTime)
        assert(length > 0.meters)
        positive(beginSpeed)
        positive(travelTime)
        positive(maxAddedDelay)
        positive(minAllowanceBefore)
    }
}

data class SummarizedSimulationResult(
    val newBeginSpeed: Double,
    val newDuration: Double,
) {
    init {
        positive(newBeginSpeed)
        positive(newDuration)
    }
}

/**
 * Generate a sequence of "segments" on which we try to run the engineering allowance. The
 * transition from "deceleration" to "acceleration" can only happen on the segment transitions.
 * Shorter segments = more solutions, but more expensive to compute.
 *
 * Note: the returned sequence is evaluated lazily, we don't actually iterate back to the first node
 * (unless necessary).
 */
fun generatePreviousSimulationSegments(
    initialEdge: STDCMEdge?,
    graph: STDCMGraph?,
    maxLength: Distance = 100.meters,
    runFullSimulation: Boolean = true,
): Sequence<SimulationSegment> = sequence {
    var currentEdge = initialEdge
    while (currentEdge != null) {
        if (currentEdge.endAtStop) break

        val envelope = currentEdge.originalEnvelope
        val edgeEndTime = currentEdge.timeData.earliestReachableTime + currentEdge.totalTime
        val maxAddedDelay = currentEdge.timeData.timeOfNextConflictAtLocation - edgeEndTime
        if (maxAddedDelay <= 0.0) break

        val backwardsPointPairs =
            fixedDistanceBackwardsEnvelopeIteration(envelope, maxLength.meters).zipWithNext()
        for ((segmentEnd, segmentStart) in backwardsPointPairs) {
            val segmentStartOffset = segmentStart.position.meters
            val segmentEndOffset = segmentEnd.position.meters

            val beginT = currentEdge.timeData.earliestReachableTime + segmentStart.time
            val endT = currentEdge.timeData.earliestReachableTime + segmentEnd.time
            val length = segmentEndOffset - segmentStartOffset
            val travelTime = scaleAllowanceTime(graph, positive(endT - beginT), length)

            val currentEdgeSnapshot = currentEdge // For closure reference

            val func =
                if (runFullSimulation)
                    { speed: Double ->
                        val pathProperties =
                            currentEdgeSnapshot.infraExplorer.getCurrentEdgePathProperties(
                                currentEdgeSnapshot.envelopeStartOffset + segmentStartOffset,
                                segmentEndOffset - segmentStartOffset
                            )
                        computeAcceleration(pathProperties, speed, graph!!)
                    }
                else
                    { speed: Double ->
                        val maxSlope = currentEdgeSnapshot.infraExplorer.getLastEdgeMaxSlope()
                        val acceleration = getAcceleration(graph!!.rollingStock, maxSlope, speed)
                        constAcceleration(speed, length, acceleration)
                    }
            yield(
                SimulationSegment(
                    beginTime = beginT,
                    length = length,
                    beginSpeed = segmentStart.speed,
                    travelTime = travelTime,
                    maxAddedDelay = maxAddedDelay,
                    computeAccelSequenceFromEndSpeed = func,
                    currentEdge.previousNode.minEngineeringAllowanceBefore,
                )
            )
        }
        currentEdge = currentEdge.previousNode.previousEdge
    }
}

/**
 * Compute a full acceleration for a given edge. The end speed is fixed and we simulate backwards.
 */
private fun computeAcceleration(
    pathProperties: PathProperties,
    endSpeed: Double,
    graph: STDCMGraph,
): SummarizedSimulationResult {
    // TODO: we could look into using const accelerations here as well instead of using
    // envelopes. We'd need to estimate the max slope for each segment.
    // It's a performance / accuracy tradeoff.

    // TODO: building an EnvelopeTrainPath each time is very expensive, we should really cache them
    // over blocks and implement views for block segments.
    val envelopePath = EnvelopeTrainPath.from(graph.rawInfra, pathProperties)
    val context =
        fr.sncf.osrd.stdcm.graph.build(
            graph.rollingStock,
            envelopePath,
            graph.timeStep,
            graph.comfort
        )

    // Compute the speedup part to reach the end speed
    val speedupPartBuilder = EnvelopePartBuilder()
    speedupPartBuilder.setAttr(EnvelopeProfile.ACCELERATING)
    val overlayBuilder =
        ConstrainedEnvelopePartBuilder(
            speedupPartBuilder,
            SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
            PositionConstraint(0.0, pathProperties.getLength().meters),
        )
    EnvelopeAcceleration.accelerate(
        context,
        pathProperties.getLength().meters,
        endSpeed,
        overlayBuilder,
        -1.0
    )
    val speedupPart = speedupPartBuilder.build()
    val envelope = Envelope.make(speedupPart)
    val newTime = scaleAllowanceTime(graph, envelope.totalTime, pathProperties.getLength())

    return SummarizedSimulationResult(
        envelope.beginSpeed,
        newTime,
    )
}

private fun constAcceleration(
    endSpeed: Double,
    length: Distance,
    acceleration: Double,
): SummarizedSimulationResult {
    val sim =
        runSimplifiedSimulation(
            acceleration,
            endSpeed,
            length.meters,
        )
    return SummarizedSimulationResult(sim.newBeginSpeed, sim.newDuration)
}

/** Estimates the acceleration for a given rolling stock at given speed and slope. */
private fun getAcceleration(rollingStock: RollingStock, maxSlope: Double, speed: Double): Double {
    val electrification =
        ImmutableRangeMap.of<Double, Electrification>(
            Range.all(),
            Electrified(rollingStock.modeNames.first())
        )
    val curve = rollingStock.mapTractiveEffortCurves(electrification, Comfort.STANDARD).curves[0.0]
    val acceleration =
        TrainPhysicsIntegrator.computeAcceleration(
            rollingStock,
            rollingStock.getRollingResistance(speed),
            TrainPhysicsIntegrator.getWeightForce(rollingStock, maxSlope),
            speed,
            PhysicsRollingStock.getMaxEffort(
                speed,
                curve,
            ),
            1.0,
        )
    return acceleration
}
