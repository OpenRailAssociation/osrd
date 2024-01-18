package fr.sncf.osrd.conflicts

import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.units.Offset
import kotlin.math.max
import kotlin.math.min

class IncrementalRequirementEnvelopeAdapter(
    private val incrementalPath: IncrementalPath,
    private val rollingStock: RollingStock,
    private val envelopeWithStops: EnvelopeTimeInterpolate
)  : IncrementalRequirementCallbacks {
    override fun arrivalTimeInRange(pathBeginOff: Offset<Path>, pathEndOff: Offset<Path>): Double {
        // if the head of the train enters the zone at some point, use that
        val travelledPathBegin = incrementalPath.toTravelledPath(pathBeginOff)
        val begin = travelledPathBegin.distance.meters
        if (begin >= 0.0 && begin <= envelopeWithStops.endPos)
            return envelopeWithStops.interpolateTotalTime(begin)

        val travelledPathEnd = incrementalPath.toTravelledPath(pathEndOff)
        val end = travelledPathEnd.distance.meters

        val trainBegin = -rollingStock.length
        val trainEnd = 0.0

        if (max(trainBegin, begin) < min(trainEnd, end))
            return 0.0

        return Double.POSITIVE_INFINITY
    }

    override fun departureTimeFromRange(pathBeginOff: Offset<Path>, pathEndOff: Offset<Path>): Double {
        val travelledPathEnd = incrementalPath.toTravelledPath(pathEndOff)
        val end = travelledPathEnd.distance.meters

        val criticalPoint = end + rollingStock.length
        if (criticalPoint >= 0.0 && criticalPoint <= envelopeWithStops.endPos)
            return envelopeWithStops.interpolateTotalTime(criticalPoint)

        if (arrivalTimeInRange(pathBeginOff, pathEndOff).isFinite())
            return envelopeWithStops.totalTime

        return Double.POSITIVE_INFINITY
    }

    override fun endTime(): Double {
        return envelopeWithStops.totalTime
    }
}
