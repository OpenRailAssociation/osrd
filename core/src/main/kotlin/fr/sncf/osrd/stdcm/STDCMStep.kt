package fr.sncf.osrd.stdcm

import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.TimeDelta
import kotlin.math.abs

data class STDCMStep(
    val locations: Collection<PathfindingEdgeLocationId<Block>>,
    val duration: Double?,
    val stop: Boolean,
    val plannedTimingData: PlannedTimingData? = null,
)

data class PlannedTimingData(
    val arrivalTime: TimeDelta,
    val arrivalTimeToleranceBefore: Duration,
    val arrivalTimeToleranceAfter: Duration,
) {
    /**
     * TimeDiff is the time difference between the train's passage and the planned timing data's
     * arrival time. This method returns the relative time diff, depending on whether the train
     * passes before or after the planned arrival time.
     */
    fun getBeforeOrAfterRelativeTimeDiff(timeDiff: Double): Double {
        return when {
            timeDiff < 0 -> abs(timeDiff / arrivalTimeToleranceBefore.seconds)
            timeDiff > 0 -> timeDiff / arrivalTimeToleranceAfter.seconds
            else -> timeDiff
        }
    }

    /**
     * Get time difference between the time at which the train passes through the node and the
     * planned time at which it should have arrived at the node.
     */
    fun getTimeDiff(time: Double): Double {
        return time - this.arrivalTime.seconds
    }
}
