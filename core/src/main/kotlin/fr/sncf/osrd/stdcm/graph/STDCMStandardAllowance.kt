package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface.NotEnoughLookahead
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.Comfort
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.graph.Pathfinding.EdgeRange
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import java.util.*

/** We try to apply the standard allowance as one mareco computation over the whole path.
 * If it causes conflicts, we split the mareco ranges so that the passage time at the points of conflict
 * stays the same as the one we expected when exploring the graph.  */

private val logger: Logger = LoggerFactory.getLogger("STDCM Allowance")

/** Applies the allowance to the final envelope  */
fun applyAllowance(
    envelope: Envelope,
    ranges: List<EdgeRange<STDCMEdge?>>,
    standardAllowance: AllowanceValue?,
    envelopeSimPath: EnvelopeSimPath,
    rollingStock: RollingStock,
    timeStep: Double,
    comfort: Comfort?,
    routeAvailability: RouteAvailabilityInterface,
    departureTime: Double,
    stops: List<TrainStop>
): Envelope {
    if (standardAllowance == null)
        return envelope // This isn't just an optimization, it avoids float inaccuracies
    val rangeTransitions = initRangeTransitions(stops)
    for (i in 0..9) {
        val newEnvelope = applyAllowanceWithTransitions(
            envelope,
            standardAllowance,
            envelopeSimPath,
            rollingStock,
            timeStep,
            comfort,
            rangeTransitions
        )
        val conflictOffset = findConflictOffsets(
            newEnvelope, routeAvailability, ranges, departureTime, stops
        )
        if (conflictOffset.isNaN())
            return newEnvelope
        assert(!rangeTransitions.contains(conflictOffset)) { "conflict offset is already on a range transition" }
        logger.info("Conflict in new envelope at offset {}, splitting mareco ranges", conflictOffset)
        rangeTransitions.add(conflictOffset)
    }
    throw RuntimeException("Couldn't find an envelope that wouldn't cause a conflict")
}

/** Initiates the range transitions with one transition on each stop  */
private fun initRangeTransitions(stops: List<TrainStop>): NavigableSet<Double> {
    val res = TreeSet<Double>()
    for (stop in stops)
        res.add(stop.position)
    return res
}

/** Looks for the first detected conflict that would happen on the given envelope.
 * If a conflict is found, returns its offset.
 * Otherwise, returns NaN.  */
private fun findConflictOffsets(
    envelope: Envelope,
    routeAvailability: RouteAvailabilityInterface,
    ranges: List<EdgeRange<STDCMEdge?>>,
    departureTime: Double,
    stops: List<TrainStop>
): Double {
    val path = makePathFromRanges(ranges)
    val envelopeWithStops = EnvelopeStopWrapper(envelope, stops)
    val availability = routeAvailability.getAvailability(
        path,
        0.0,
        envelope.endPos,
        envelopeWithStops,
        departureTime
    )
    assert(availability !is NotEnoughLookahead)
    return (availability as? RouteAvailabilityInterface.Unavailable)?.firstConflictOffset ?: Double.NaN
}

/** Applies the allowance to the final envelope, with range transitions at the given offsets  */
private fun applyAllowanceWithTransitions(
    envelope: Envelope,
    standardAllowance: AllowanceValue,
    envelopeSimPath: EnvelopeSimPath,
    rollingStock: RollingStock,
    timeStep: Double,
    comfort: Comfort?,
    rangeTransitions: NavigableSet<Double>
): Envelope {
    val allowance = MarecoAllowance(
        0.0,
        envelope.endPos,
        1.0,
        makeAllowanceRanges(standardAllowance, envelope.endPos, rangeTransitions)
    )
    return allowance.apply(
        envelope,
        build(rollingStock, envelopeSimPath, timeStep, comfort)
    )
}

/** Create the list of `AllowanceRange`, with the given transitions  */
private fun makeAllowanceRanges(
    allowance: AllowanceValue,
    pathLength: Double,
    rangeTransitions: SortedSet<Double>
): List<AllowanceRange> {
    var transition = 0.0
    val res = ArrayList<AllowanceRange>()
    for (end in rangeTransitions) {
        if (transition == end)
            continue
        assert(transition < end)
        res.add(AllowanceRange(transition, end, allowance))
        transition = end
    }
    if (transition < pathLength)
        res.add(AllowanceRange(transition, pathLength, allowance))
    return res
}
