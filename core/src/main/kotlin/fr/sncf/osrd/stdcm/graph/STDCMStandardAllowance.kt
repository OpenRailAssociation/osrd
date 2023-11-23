package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.graph.Pathfinding.EdgeRange
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface.NotEnoughLookahead
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.Comfort
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters
import fr.sncf.osrd.utils.units.Offset
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.util.*

/** We try to apply the standard allowance as one mareco computation over the whole path.
 * If it causes conflicts, we split the mareco ranges so that the passage time at the points of conflict
 * stays the same as the one we expected when exploring the graph.  */
object STDCMStandardAllowance

val logger: Logger = LoggerFactory.getLogger(STDCMStandardAllowance::class.java)

/** Applies the allowance to the final envelope  */
fun applyAllowance(
    graph: STDCMGraph,
    envelope: Envelope,
    ranges: List<EdgeRange<STDCMEdge, STDCMEdge>>,
    standardAllowance: AllowanceValue?,
    envelopeSimPath: EnvelopeSimPath?,
    rollingStock: RollingStock?,
    timeStep: Double,
    comfort: Comfort?,
    blockAvailability: BlockAvailabilityInterface,
    departureTime: Double,
    stops: List<TrainStop>
): Envelope {
    if (standardAllowance == null
        || standardAllowance.getAllowanceTime(envelope.totalTime, envelope.totalDistance) < 1e-5
    )
        return envelope // This isn't just an optimization, it avoids float inaccuracies and possible errors
    val rangeTransitions = initRangeTransitions(stops)
    val context = build(rollingStock!!, envelopeSimPath!!, timeStep, comfort)
    for (i in 0..9) {
        try {
            val newEnvelope = applyAllowanceWithTransitions(
                envelope,
                standardAllowance,
                rangeTransitions,
                context
            )
            val conflictOffset = findConflictOffsets(newEnvelope, blockAvailability, ranges, departureTime, stops)
                ?: return newEnvelope
            if (rangeTransitions.contains(conflictOffset))
                break // Error case, we exit and fallback to the linear envelope
            logger.info("Conflict in new envelope at offset {}, splitting mareco ranges", conflictOffset)
            rangeTransitions.add(conflictOffset)
        } catch (e: OSRDError) {
            if (e.osrdErrorType == ErrorType.AllowanceConvergenceTooMuchTime) {
                // Mareco allowances must have a non-zero capacity speed limit,
                // which may cause "too much time" errors.
                // We can ignore this exception and move on to the linear allowance as fallback
                logger.info("Can't slow down enough to match the given standard allowance")
                break
            } else
                throw e
        }
    }
    logger.info("Failed to compute a mareco standard allowance, fallback to linear allowance")
    return makeFallbackEnvelope(envelope, standardAllowance, context)
}

/** Creates an envelope with a linear allowance. To be used in case we fail to compute a mareco envelope  */
private fun makeFallbackEnvelope(
    envelope: Envelope,
    standardAllowance: AllowanceValue,
    context: EnvelopeSimContext
): Envelope {
    return LinearAllowance(
        0.0, envelope.endPos, 0.0, listOf(
            AllowanceRange(0.0, envelope.endPos, standardAllowance)
        )
    ).apply(envelope, context)
}

/** Initiates the range transitions with one transition on each stop  */
private fun initRangeTransitions(stops: List<TrainStop>): NavigableSet<Offset<Path>> {
    val res = TreeSet<Offset<Path>>()
    for (stop in stops)
        res.add(Offset(fromMeters(stop.position)))
    return res
}

/** Looks for the first detected conflict that would happen on the given envelope.
 * If a conflict is found, returns its offset.
 * Otherwise, returns NaN.  */
private fun findConflictOffsets(
    envelope: Envelope,
    blockAvailability: BlockAvailabilityInterface,
    ranges: List<EdgeRange<STDCMEdge, STDCMEdge>>,
    departureTime: Double,
    stops: List<TrainStop>
): Offset<Path>? {
    val envelopeWithStops = EnvelopeStopWrapper(envelope, stops)
    val startOffset = ranges[0].start
    val endOffset = startOffset + Distance(millimeters = ranges.stream()
        .mapToLong { range -> (range.end - range.start).millimeters }
        .sum())
    val blocks = ranges.stream()
        .map { x -> x.edge.block }
        .toList()
    assert(TrainPhysicsIntegrator.arePositionsEqual(envelopeWithStops.endPos, (endOffset - startOffset).meters))
    val availability = blockAvailability.getAvailability(
        blocks,
        startOffset.distance,
        endOffset.distance,
        envelopeWithStops,
        departureTime
    )
    assert(availability.javaClass != NotEnoughLookahead::class.java)
    val offsetDistance = (availability as? BlockAvailabilityInterface.Unavailable)?.firstConflictOffset ?: return null
    return Offset(offsetDistance)
}

/** Applies the allowance to the final envelope, with range transitions at the given offsets  */
private fun applyAllowanceWithTransitions(
    envelope: Envelope,
    standardAllowance: AllowanceValue,
    rangeTransitions: NavigableSet<Offset<Path>>,
    context: EnvelopeSimContext
): Envelope {
    val allowance = MarecoAllowance(
        0.0,
        envelope.endPos,
        1.0,
        makeAllowanceRanges(standardAllowance, envelope.endPos, rangeTransitions)
    )
    return allowance.apply(envelope, context)
}

/** Create the list of `AllowanceRange`, with the given transitions  */
private fun makeAllowanceRanges(
    allowance: AllowanceValue,
    envelopeLength: Double,
    rangeTransitions: SortedSet<Offset<Path>>
): List<AllowanceRange> {
    var transition = 0.0
    val res = ArrayList<AllowanceRange>()
    for (endMM in rangeTransitions) {
        val end = endMM.distance.meters
        if (transition == end)
            continue
        assert(transition < end)
        res.add(AllowanceRange(transition, end, allowance))
        transition = end
    }
    if (transition < envelopeLength)
        res.add(AllowanceRange(transition, envelopeLength, allowance))
    return res
}
