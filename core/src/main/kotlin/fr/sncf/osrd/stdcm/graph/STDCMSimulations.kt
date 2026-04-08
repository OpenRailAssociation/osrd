package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import fr.sncf.osrd.envelope_sim.pipelines.maxEffortEnvelopeFrom
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.stdcm.BacktrackingSelfTypeHolder
import fr.sncf.osrd.stdcm.CachedBlockMaxSpeedEnvBuilder
import fr.sncf.osrd.utils.SelfTypeHolder
import java.lang.ref.SoftReference

/** This class contains all the methods used to simulate the train behavior. */
class STDCMSimulations(private val cachedBlockMaxSpeedEnvBuilder: CachedBlockMaxSpeedEnvBuilder) {
    private var simulatedEnvelopes: HashMap<BlockSimulationParameters, SoftReference<Envelope>?> =
        HashMap()

    // Used to log how many simulations failed (to log it once at the end of the processing)
    private var nFailedSimulation = 0

    /**
     * Returns the corresponding envelope if the block's envelope has already been computed in
     * simulatedEnvelopes, otherwise computes the matching envelope and adds it to the STDCMGraph.
     */
    fun simulateBlock(blockParams: BlockSimulationParameters): Envelope? {
        val roundedBlockParams = blockParams.round()
        val cached = simulatedEnvelopes.getOrDefault(roundedBlockParams, null)?.get()
        if (cached != null) return cached
        val simulatedEnvelope = simulateBlockNoCache(roundedBlockParams)
        simulatedEnvelopes[roundedBlockParams] = SoftReference(simulatedEnvelope)
        return simulatedEnvelope
    }

    /**
     * Computes the corresponding envelope.
     *
     * Note: there are some approximations made here as we only "see" the tracks on the given
     * blocks. We are missing slopes and speed limits from earlier in the path.
     */
    private fun simulateBlockNoCache(blockParams: BlockSimulationParameters): Envelope? {
        val (block, initialSpeed, start, stopPosition) = blockParams
        assert(stopPosition == null || stopPosition >= start)
        if (stopPosition != null && stopPosition == start) return makeSinglePointEnvelope(0.0)
        val blockLength = cachedBlockMaxSpeedEnvBuilder.blockInfra.getBlockLength(block)
        if (start >= blockLength) return makeSinglePointEnvelope(initialSpeed)
        return try {
            val context = cachedBlockMaxSpeedEnvBuilder.getMrspAndContext(block).context
            val maxSpeedEnvelope = cachedBlockMaxSpeedEnvBuilder.getMaxSpeedEnvelope(block, null)
            Envelope.make(
                    *maxEffortEnvelopeFrom(context, initialSpeed, maxSpeedEnvelope)
                        .slice(start.meters, (stopPosition ?: blockLength).meters)
                )
                .copyAndShift(-start.meters)
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
fun makeSinglePointEnvelope(speed: Double): Envelope {
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
