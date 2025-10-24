package fr.sncf.osrd.conflicts

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope.EnvelopeInterpolate
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.math.max
import kotlin.math.min

class IncrementalRequirementEnvelopeAdapter(
    private val rollingStock: PhysicsRollingStock,
    private val envelopeWithStops: EnvelopeInterpolate?,
    override var simulationComplete: Boolean,

    // If set to true, we consider that the train doesn't leave its current stop (yet).
    // Used to evaluate conflicts up to a stop, including the stop itself,
    // but without considering the reservation on blocks/routes after the stop
    // (especially to avoid being bothered by the reservation margin before restarting after a stop
    // on closed signal).
    private val infiniteLastStop: Boolean = false,
) : IncrementalRequirementCallbacks {
    override fun maxSpeedInRange(
        pathBeginOff: Offset<TravelledPath>,
        pathEndOff: Offset<TravelledPath>,
    ): Double {
        if (envelopeWithStops == null) {
            return Double.POSITIVE_INFINITY
        }
        val begin = pathBeginOff.meters
        val end = pathEndOff.meters
        if (max(0.0, begin) >= min(envelopeWithStops.endPos, end)) {
            return Double.POSITIVE_INFINITY // no overlap
        }
        return envelopeWithStops.maxSpeedInRange(
            max(begin, 0.0),
            min(end, envelopeWithStops.endPos),
        )
    }

    override fun departureFromStop(stopOffset: Offset<TravelledPath>): Double {
        if (envelopeWithStops == null) {
            return Double.POSITIVE_INFINITY
        }
        val endPos = envelopeWithStops.endPos
        if (stopOffset.meters > endPos) {
            return Double.POSITIVE_INFINITY
        }
        // stop duration is included in interpolateDepartureFrom()
        var pastStop = (stopOffset.distance).meters
        if (pastStop > endPos) {
            pastStop = endPos
        }
        if (pastStop == endPos && infiniteLastStop) {
            // The requested stop is at the end of the simulated path,
            // and the requested behavior is to make that stop "infinite"
            // (pushing next reservation's start-time to "never").
            return Double.POSITIVE_INFINITY
        }
        return envelopeWithStops.interpolateDepartureFrom(pastStop)
    }

    override fun getRawEnvelopeIfSingle(): Envelope? {
        return envelopeWithStops?.rawEnvelopeIfSingle
    }

    override fun arrivalTimeInRange(
        pathBeginOff: Offset<TravelledPath>,
        pathEndOff: Offset<TravelledPath>,
    ): Double {
        if (envelopeWithStops == null) return Double.POSITIVE_INFINITY
        // if the head of the train enters the zone at some point, use that
        val begin = pathBeginOff.meters
        if (begin >= 0.0 && begin <= envelopeWithStops.endPos)
            return envelopeWithStops.interpolateArrivalAt(begin)

        val end = pathEndOff.meters

        val trainBegin = -rollingStock.length
        val trainEnd = 0.0

        if (max(trainBegin, begin) < min(trainEnd, end)) return 0.0

        return Double.POSITIVE_INFINITY
    }

    override fun departureTimeFromRange(
        pathBeginOff: Offset<TravelledPath>,
        pathEndOff: Offset<TravelledPath>,
    ): Double {
        if (envelopeWithStops == null) return Double.POSITIVE_INFINITY
        val end = pathEndOff.meters

        val criticalPoint = end + rollingStock.length
        if (criticalPoint >= 0.0 && criticalPoint <= envelopeWithStops.endPos)
            return envelopeWithStops.interpolateDepartureFrom(criticalPoint)

        return Double.POSITIVE_INFINITY
    }

    override val currentTime
        get() = envelopeWithStops?.totalTime ?: 0.0

    override val currentPathOffset
        get() = Offset<TravelledPath>(envelopeWithStops?.endPos?.meters ?: 0.meters)

    override fun clone(): IncrementalRequirementCallbacks {
        return IncrementalRequirementEnvelopeAdapter(
            rollingStock,
            envelopeWithStops, // This is effectively read-only, we don't need a deep copy here
            simulationComplete,
            infiniteLastStop,
        )
    }
}
