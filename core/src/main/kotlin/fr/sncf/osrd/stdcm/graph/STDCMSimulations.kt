package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import fr.sncf.osrd.envelope_sim.pipelines.SimStop
import fr.sncf.osrd.envelope_sim.pipelines.maxEffortEnvelopeFrom
import fr.sncf.osrd.envelope_sim.pipelines.maxSpeedEnvelopeFrom
import fr.sncf.osrd.envelope_sim_infra.computeMRSP
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.stdcm.BacktrackingSelfTypeHolder
import fr.sncf.osrd.stdcm.graph.engineering_allowance.runSimplifiedSimulation
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.utils.SelfTypeHolder
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.lang.ref.SoftReference
import kotlin.math.absoluteValue
import kotlin.math.min

/** This class contains all the methods used to simulate the train behavior. */
class STDCMSimulations {
    private var simulatedEnvelopes: HashMap<BlockSimulationParameters, SoftReference<Envelope>?> =
        HashMap()

    // Used to log how many simulations failed (to log it once at the end of the processing)
    private var nFailedSimulation = 0

    /**
     * Returns the corresponding envelope if the block's envelope has already been computed in
     * simulatedEnvelopes, otherwise computes the matching envelope and adds it to the STDCMGraph.
     */
    fun simulateBlock(
        rollingStock: PhysicsRollingStock,
        comfort: Comfort?,
        timeStep: Double,
        trainTag: String?,
        temporarySpeedLimitManager: TemporarySpeedLimitManager?,
        infraExplorer: InfraExplorer,
        blockParams: BlockSimulationParameters,
    ): Envelope? {
        val cached = simulatedEnvelopes.getOrDefault(blockParams, null)?.get()
        if (cached != null) return cached
        val simulatedEnvelope =
            simulateBlock(
                infraExplorer,
                blockParams.initialSpeed,
                blockParams.endSpeed,
                blockParams.start,
                rollingStock,
                comfort,
                timeStep,
                blockParams.stop,
                trainTag,
                temporarySpeedLimitManager,
            )
        simulatedEnvelopes[blockParams] = SoftReference(simulatedEnvelope)
        return simulatedEnvelope
    }

    /**
     * Compute the maximum safe speed at the end of the current block, given the lookahead. Looks at
     * upcoming speed limits and stops in the lookahead blocks, and uses constant deceleration to
     * compute how fast the train can go at the current block boundary while still being able to
     * decelerate in time.
     */
    fun getEndSpeed(
        infraExplorer: InfraExplorerWithEnvelope,
        temporarySpeedLimitManager: TemporarySpeedLimitManager?,
        trainTag: String?,
    ): Double {
        val rollingStock = infraExplorer.getCurrentRollingStock()
        val acceleration = -rollingStock.deceleration.absoluteValue
        val lookahead = infraExplorer.getLookahead()
        if (lookahead.isEmpty()) return Double.POSITIVE_INFINITY

        val maxSpeed = rollingStock.maxSpeed
        val brakingDistance = maxSpeed * maxSpeed / (2 * rollingStock.deceleration)
        val lookaheadLength = lookahead.sumOf { it.length.meters }
        assert(lookaheadLength >= brakingDistance) {
            "Lookahead too short for full braking: $lookaheadLength < $brakingDistance"
        }

        var currentMinSpeed = Double.POSITIVE_INFINITY
        fun addSpeedConstraint(speed: Double, distanceAfterCurrentBlockEnd: Distance) {
            val minPossibleSpeed =
                runSimplifiedSimulation(acceleration, speed, distanceAfterCurrentBlockEnd.meters)
                    .newBeginSpeed
            currentMinSpeed = min(currentMinSpeed, minPossibleSpeed)
        }

        // Check stops in the lookahead
        for (step in infraExplorer.getStepTracker().iterateStepsInLookaheadBackwards()) {
            if (!step.originalStep.stop) continue
            val distanceAfterBlockEnd =
                step.travelledPathOffset -
                    infraExplorer.getCurrentBlockRange().objectAbsolutePathEnd
            if (distanceAfterBlockEnd <= 0.meters) continue
            addSpeedConstraint(0.0, distanceAfterBlockEnd)
        }

        // Check speed limits in the lookahead blocks
        var previousOffset = 0.meters
        for (blockRange in lookahead) {
            val path = infraExplorer.getBlockPathProperties(blockRange)
            val speedLimits = path.getSpeedLimitProperties(trainTag, temporarySpeedLimitManager)
            speedLimits.forEach { lower, _, value ->
                addSpeedConstraint(value.speed.metersPerSecond, previousOffset + lower)
            }
            previousOffset += path.getLength().distance
            if (
                runSimplifiedSimulation(acceleration, 0.0, previousOffset.meters).newBeginSpeed >
                    currentMinSpeed
            )
                break
        }
        return currentMinSpeed
    }

    /**
     * Returns an envelope matching the given block. The envelope time starts when the train enters
     * the block. stopPosition specifies the position at which the train should stop, may be null
     * (no stop).
     *
     * Note: there are some approximations made here as we only "see" the tracks on the given
     * blocks. We are missing slopes and speed limits from earlier in the path.
     */
    fun simulateBlock(
        infraExplorer: InfraExplorer,
        initialSpeed: Double,
        endSpeed: Double,
        start: Offset<Block>,
        rollingStock: PhysicsRollingStock,
        comfort: Comfort?,
        timeStep: Double,
        stopPosition: Offset<Block>?,
        trainTag: String?,
        temporarySpeedLimitManager: TemporarySpeedLimitManager?,
    ): Envelope? {
        assert(stopPosition == null || stopPosition >= start)
        if (stopPosition != null && stopPosition == start) return makeSinglePointEnvelope(0.0)
        val blockLength = infraExplorer.getCurrentBlockLength()
        if (start >= blockLength) return makeSinglePointEnvelope(initialSpeed)
        var stops = emptyList<SimStop>()
        var simLength = blockLength.distance - start.distance
        if (stopPosition != null) {
            val stopOffset = Offset<PhysicsPath>(stopPosition - start)
            // We presently consider all stdcm stops to be performed on closed signal by default
            // This presently only affects ETCS computations, which are not yet supported in stdcm
            // either
            stops = listOf(SimStop(stopOffset, RJSReceptionSignal.SHORT_SLIP_STOP))
            simLength = Distance.min(simLength, stopOffset.distance)
        }
        val path = infraExplorer.getCurrentEdgePathProperties(start, simLength)
        val context = build(rollingStock, path, timeStep, comfort)
        val mrsp = computeMRSP(path, rollingStock, false, trainTag, temporarySpeedLimitManager)
        return try {
            val maxSpeedEnvelope = maxSpeedEnvelopeFrom(context, stops, mrsp)
            val maxEffortEnvelope = maxEffortEnvelopeFrom(context, initialSpeed, maxSpeedEnvelope)
            if (endSpeed < maxEffortEnvelope.endSpeed)
                addEndBrakingPart(context, endSpeed, maxEffortEnvelope)
            else maxEffortEnvelope
        } catch (e: OSRDError) {
            // The train can't reach its destination, for example because of high slopes
            if (nFailedSimulation == 0) {
                // We only log the first one (to get an actual error message but not spam any
                // further)
                logger.info(
                    "First failure of an STDCM Simulation during the search (ignoring this possible path): ${e.message}"
                )
            }
            nFailedSimulation++
            null
        }
    }

    /**
     * Log any relevant warnings about what happened during the processing, to be called once at the
     * end. Aggregates events into fewer log entries.
     */
    fun logWarnings() {
        if (nFailedSimulation > 0)
            logger.info(
                "A total of $nFailedSimulation STDCM Simulations failed during the search (usually because of lack of traction)"
            )
    }
}

/** Make an envelope with a single point of the given speed */
private fun makeSinglePointEnvelope(speed: Double): Envelope {
    return Envelope.make(
        EnvelopePart(
            mapOf<Class<out SelfTypeHolder>, SelfTypeHolder>(
                Pair(EnvelopeProfile::class.java, EnvelopeProfile.CONSTANT_SPEED)
            ),
            doubleArrayOf(0.0),
            doubleArrayOf(speed),
            doubleArrayOf(),
        )
    )
}

/** Returns a new envelope with a different end speed. */
fun addEndBrakingPart(
    context: EnvelopeSimContext,
    endSpeed: Double,
    oldEnvelope: Envelope,
): Envelope {
    if (endSpeed >= oldEnvelope.endSpeed) return oldEnvelope
    val partBuilder = EnvelopePartBuilder()
    partBuilder.setAttr(EnvelopeProfile.BRAKING)
    partBuilder.setAttr(BacktrackingSelfTypeHolder())
    val overlayBuilder =
        ConstrainedEnvelopePartBuilder(
            partBuilder,
            SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
            EnvelopeConstraint(oldEnvelope, EnvelopePartConstraintType.CEILING),
        )
    EnvelopeDeceleration.decelerate(context, oldEnvelope.endPos, endSpeed, overlayBuilder, -1.0)
    val builder = OverlayEnvelopeBuilder.backward(oldEnvelope)
    builder.addPart(partBuilder.build())
    return builder.build()
}
