package fr.sncf.osrd.conflicts

import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.math.max
import kotlin.math.min

class IncrementalRequirementEnvelopeAdapter(
    private val rollingStock: RollingStock,
    private val envelopeWithStops: EnvelopeStopWrapper,
    override var simulationComplete: Boolean,
) : IncrementalRequirementCallbacks {
    override fun arrivalTimeInRange(
        pathBeginOff: Offset<TravelledPath>,
        pathEndOff: Offset<TravelledPath>
    ): Double {
        // if the head of the train enters the zone at some point, use that
        val begin = pathBeginOff.distance.meters
        if (begin >= 0.0 && begin <= envelopeWithStops.endPos)
            return envelopeWithStops.interpolateTotalTime(begin)

        val end = pathEndOff.distance.meters

        val trainBegin = -rollingStock.length
        val trainEnd = 0.0

        if (max(trainBegin, begin) < min(trainEnd, end)) return 0.0

        return Double.POSITIVE_INFINITY
    }

    override fun departureTimeFromRange(
        pathBeginOff: Offset<TravelledPath>,
        pathEndOff: Offset<TravelledPath>
    ): Double {
        val end = pathEndOff.distance.meters

        val criticalPoint = end + rollingStock.length
        if (criticalPoint >= 0.0 && criticalPoint <= envelopeWithStops.endPos)
            return envelopeWithStops.interpolateTotalTime(criticalPoint)

        if (arrivalTimeInRange(pathBeginOff, pathEndOff).isFinite())
            return envelopeWithStops.totalTime

        return Double.POSITIVE_INFINITY
    }

    override val currentTime
        get() = envelopeWithStops.totalTime

    override val currentPathOffset
        get() = Offset<TravelledPath>(envelopeWithStops.endPos.meters)
}
