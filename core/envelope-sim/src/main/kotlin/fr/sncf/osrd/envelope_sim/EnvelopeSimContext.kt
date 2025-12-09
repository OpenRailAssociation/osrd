package fr.sncf.osrd.envelope_sim

import com.google.common.collect.RangeMap
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.utils.DistanceRangeSet
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

class EnvelopeSimContext
@JvmOverloads
constructor(
    @JvmField val rollingStock: PhysicsRollingStock,
    @JvmField val path: PhysicsPath,
    @JvmField val timeStep: Double,
    @JvmField
    val tractiveEffortCurveMap: RangeMap<Double, Array<PhysicsRollingStock.TractiveEffortPoint>>,
    /** If the train should follow ETCS rules, this contains some extra context */
    val etcsContext: ETCSContext? = null,
) {

    data class ETCSContext(
        /**
         * Offset<TravelledPath> ranges where ETCS rules are applied. Braking curves are computed
         * using ETCS rules if they *end* in these ranges.
         */
        val applicationRanges: DistanceRangeSet,
        /**
         * List of switch and buffer stop offsets on the path, up to the first switch/buffer stop
         * *after* the end of the path (or right at the end).
         */
        val dangerPointOffsets: List<Offset<TrainPath>>,
        /**
         * List of block-delimiting detectors (block entry/exit) offsets for every ETCS-block on the
         * path. Starts at the start of the path, can end after the end of the path.
         */
        val detectorOffsets: List<Offset<TrainPath>>,
    ) {
        /**
         * Returns the next danger point location: next buffer stop or switch, whichever is closest.
         * If there is any.
         */
        private fun getDangerPoint(offset: Offset<TrainPath>): Offset<TrainPath>? {
            return dangerPointOffsets.firstOrNull { it >= offset }
        }

        /**
         * On a closed signal stop or for a route-delimiter signal, a danger point is always located
         * less than 200m away. This method returns the next danger point location if it is less
         * than 200m away. If there isn't any, we're probably missing a danger point in the
         * infrastructure, hence we'll be conservative and place the danger point on the EoA (stop
         * location or signal).
         */
        fun getMandatoryDangerPoint(signalOffset: Offset<TrainPath>): Offset<TrainPath> {
            val dangerPoint = getDangerPoint(signalOffset)
            return if (dangerPoint == null || dangerPoint - signalOffset > 200.meters) signalOffset
            else dangerPoint
        }

        /** Returns the next ETCS detector location. */
        fun getNextDetector(offset: Offset<TrainPath>): Offset<TrainPath>? {
            return detectorOffsets.firstOrNull { it >= offset }
        }
    }

    fun updateCurves(
        tractiveEffortCurveMap: RangeMap<Double, Array<PhysicsRollingStock.TractiveEffortPoint>>
    ): EnvelopeSimContext {
        return EnvelopeSimContext(rollingStock, path, timeStep, tractiveEffortCurveMap, etcsContext)
    }
}
