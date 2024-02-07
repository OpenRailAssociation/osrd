package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeAttr
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder
import fr.sncf.osrd.envelope.part.EnvelopePart
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint
import fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint
import fr.sncf.osrd.envelope_sim.EnvelopeProfile
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.FixedTime
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath
import fr.sncf.osrd.envelope_sim_infra.MRSP
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.stdcm.BacktrackingEnvelopeAttr
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.Comfort
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/** This class contains all the methods used to simulate the train behavior. */
class STDCMSimulations {
    private var simulatedEnvelopes: HashMap<BlockSimulationParameters, Envelope?> = HashMap()

    /**
     * Returns the corresponding envelope if the block's envelope has already been computed in
     * simulatedEnvelopes, otherwise computes the matching envelope and adds it to the STDCMGraph.
     */
    fun simulateBlock(
        rawInfra: RawSignalingInfra,
        blockInfra: BlockInfra,
        rollingStock: RollingStock,
        comfort: Comfort?,
        timeStep: Double,
        trainTag: String?,
        blockParams: BlockSimulationParameters
    ): Envelope? {
        return if (simulatedEnvelopes.containsKey(blockParams)) {
            simulatedEnvelopes[blockParams]
        } else {
            val simulatedEnvelope =
                simulateBlock(
                    rawInfra,
                    blockInfra,
                    blockParams.blockId,
                    blockParams.initialSpeed,
                    blockParams.start,
                    rollingStock,
                    comfort,
                    timeStep,
                    blockParams.stop,
                    trainTag
                )
            simulatedEnvelopes[blockParams] = simulatedEnvelope
            simulatedEnvelope
        }
    }
}

/**
 * Create an EnvelopeSimContext instance from the blocks and extra parameters. offsetFirstBlock is
 * in millimeters.
 */
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
 * block. stopPosition specifies the position at which the train should stop, may be null (no stop)
 * start is in millimeters
 *
 * Note: there are some approximations made here as we only "see" the tracks on the given blocks. We
 * are missing slopes and speed limits from earlier in the path.
 */
fun simulateBlock(
    rawInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    blockId: BlockId,
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
    val blockLength = blockInfra.getBlockLength(blockId)
    if (start >= blockLength) return makeSinglePointEnvelope(initialSpeed)
    val context =
        makeSimContext(
            rawInfra,
            blockInfra,
            listOf(blockId),
            start,
            rollingStock,
            comfort,
            timeStep
        )
    var stops = doubleArrayOf()
    var simLength: Offset<Block> = Offset(blockLength - start)
    if (stopPosition != null) {
        stops = doubleArrayOf(stopPosition.distance.meters)
        simLength = Offset.min(simLength, stopPosition)
    }
    val path = makePathProps(blockInfra, rawInfra, blockId, Offset(0.meters), simLength)
    val mrsp = MRSP.computeMRSP(path, rollingStock, false, trainTag)
    return try {
        val maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp)
        MaxEffortEnvelope.from(context, initialSpeed, maxSpeedEnvelope)
    } catch (e: OSRDError) {
        // The train can't reach its destination, for example because of high slopes
        null
    }
}

/** Make an envelope with a single point of the given speed */
private fun makeSinglePointEnvelope(speed: Double): Envelope {
    return Envelope.make(
        EnvelopePart(
            mapOf<Class<out EnvelopeAttr>, EnvelopeAttr>(
                Pair(EnvelopeProfile::class.java, EnvelopeProfile.CONSTANT_SPEED)
            ),
            doubleArrayOf(0.0),
            doubleArrayOf(speed),
            doubleArrayOf()
        )
    )
}

/** Returns the time at which the offset on the given edge is reached */
fun interpolateTime(
    envelope: Envelope,
    edgeOffset: Offset<STDCMEdge>,
    startTime: Double,
    speedRatio: Double
): Double {
    assert(edgeOffset.distance <= fromMeters(envelope.endPos))
    assert(edgeOffset.distance >= 0.meters)
    return startTime + envelope.interpolateTotalTime(edgeOffset.distance.meters) / speedRatio
}

/** Try to apply an allowance on the given envelope to add the given delay */
fun findEngineeringAllowance(
    context: EnvelopeSimContext,
    oldEnvelope: Envelope,
    neededDelay: Double
): Envelope? {
    var mutNeededDelay = neededDelay
    mutNeededDelay += context.timeStep // error margin for the dichotomy
    val ranges = listOf(AllowanceRange(0.0, oldEnvelope.endPos, FixedTime(mutNeededDelay)))
    val capacitySpeedLimit =
        1 // We set a minimum because generating curves at very low speed can cause issues
    // TODO: add a parameter and set a higher default value once we can handle proper stops
    val allowance = LinearAllowance(0.0, oldEnvelope.endPos, capacitySpeedLimit.toDouble(), ranges)
    return try {
        allowance.apply(oldEnvelope, context)
    } catch (e: OSRDError) {
        null
    }
}

/** returns an envelope for a block that already has an envelope, but with a different end speed */
fun simulateBackwards(
    rawInfra: RawSignalingInfra,
    blockInfra: BlockInfra,
    blockId: BlockId,
    endSpeed: Double,
    start: Offset<Block>,
    oldEnvelope: Envelope,
    graph: STDCMGraph
): Envelope {
    val context =
        makeSimContext(
            rawInfra,
            blockInfra,
            listOf(blockId),
            start,
            graph.rollingStock,
            graph.comfort,
            graph.timeStep
        )
    val partBuilder = EnvelopePartBuilder()
    partBuilder.setAttr(EnvelopeProfile.BRAKING)
    partBuilder.setAttr(BacktrackingEnvelopeAttr())
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
