package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.api.pathfinding.makePathProps
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
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.envelope_sim_infra.MRSP
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.stdcm.BacktrackingSelfTypeHolder
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.SelfTypeHolder
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.lang.ref.SoftReference

/** This class contains all the methods used to simulate the train behavior. */
class STDCMSimulations {
    private var simulatedEnvelopes: HashMap<BlockSimulationParameters, SoftReference<Envelope>?> =
        HashMap()

    /**
     * Returns the corresponding envelope if the block's envelope has already been computed in
     * simulatedEnvelopes, otherwise computes the matching envelope and adds it to the STDCMGraph.
     */
    fun simulateBlock(
        rawInfra: RawSignalingInfra,
        rollingStock: RollingStock,
        comfort: Comfort?,
        timeStep: Double,
        trainTag: String?,
        infraExplorer: InfraExplorer,
        blockParams: BlockSimulationParameters
    ): Envelope? {
        val cached = simulatedEnvelopes.getOrDefault(blockParams, null)?.get()
        if (cached != null) return cached
        val simulatedEnvelope =
            simulateBlock(
                rawInfra,
                infraExplorer,
                blockParams.initialSpeed,
                blockParams.start,
                rollingStock,
                comfort,
                timeStep,
                blockParams.stop,
                trainTag
            )
        simulatedEnvelopes[blockParams] = SoftReference(simulatedEnvelope)
        return simulatedEnvelope
    }
}

/** Create an EnvelopeSimContext instance from the blocks and extra parameters. */
fun makeSimContext(
    rawInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    blocks: List<BlockId>,
    offsetFirstBlock: Offset<Block>,
    rollingStock: RollingStock,
    comfort: Comfort?,
    timeStep: Double
): EnvelopeSimContext {
    val path = makePathProps(rawInfra, blockInfra, blocks, offsetFirstBlock.cast())
    val envelopePath = EnvelopeTrainPath.from(rawInfra, path)
    return build(rollingStock, envelopePath, timeStep, comfort)
}

/**
 * Returns an envelope matching the given block. The envelope time starts when the train enters the
 * block. stopPosition specifies the position at which the train should stop, may be null (no stop).
 *
 * Note: there are some approximations made here as we only "see" the tracks on the given blocks. We
 * are missing slopes and speed limits from earlier in the path.
 */
fun simulateBlock(
    rawInfra: RawSignalingInfra,
    infraExplorer: InfraExplorer,
    initialSpeed: Double,
    start: Offset<Block>,
    rollingStock: RollingStock,
    comfort: Comfort?,
    timeStep: Double,
    stopPosition: Offset<Block>?,
    trainTag: String?
): Envelope? {
    if (stopPosition != null && stopPosition == Offset<Block>(0.meters))
        return makeSinglePointEnvelope(0.0)
    val blockLength = infraExplorer.getCurrentBlockLength()
    if (start >= blockLength) return makeSinglePointEnvelope(initialSpeed)
    var stops = doubleArrayOf()
    var simLength = blockLength.distance - start.distance
    if (stopPosition != null) {
        stops = doubleArrayOf(stopPosition.distance.meters)
        simLength = Distance.min(simLength, stopPosition.distance)
    }
    val path = infraExplorer.getCurrentEdgePathProperties(start, simLength)
    val envelopePath = EnvelopeTrainPath.from(rawInfra, path)
    val context = build(rollingStock, envelopePath, timeStep, comfort)
    val mrsp = MRSP.computeMRSP(path, rollingStock, false, trainTag)
    return try {
        val maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp)
        MaxEffortEnvelope.from(context, initialSpeed, maxSpeedEnvelope)
    } catch (e: OSRDError) {
        // The train can't reach its destination, for example because of high slopes
        logger.info("STDCM Simulation failed (ignoring this possible path): ${e.message}")
        null
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
            doubleArrayOf()
        )
    )
}

/** returns an envelope for a block that already has an envelope, but with a different end speed */
fun simulateBackwards(
    rawInfra: RawSignalingInfra,
    infraExplorer: InfraExplorer,
    endSpeed: Double,
    start: Offset<Block>,
    oldEnvelope: Envelope,
    graph: STDCMGraph
): Envelope {
    val path = infraExplorer.getCurrentEdgePathProperties(start, null)
    val envelopePath = EnvelopeTrainPath.from(rawInfra, path)
    val context = build(graph.rollingStock, envelopePath, graph.timeStep, graph.comfort)
    val partBuilder = EnvelopePartBuilder()
    partBuilder.setAttr(EnvelopeProfile.BRAKING)
    partBuilder.setAttr(BacktrackingSelfTypeHolder())
    val overlayBuilder =
        ConstrainedEnvelopePartBuilder(
            partBuilder,
            SpeedConstraint(0.0, EnvelopePartConstraintType.FLOOR),
            EnvelopeConstraint(oldEnvelope, EnvelopePartConstraintType.CEILING)
        )
    EnvelopeDeceleration.decelerate(context, oldEnvelope.endPos, endSpeed, overlayBuilder, -1.0)
    val builder = OverlayEnvelopeBuilder.backward(oldEnvelope)
    builder.addPart(partBuilder.build())
    return builder.build()
}
