package fr.sncf.osrd.conflicts

import com.google.common.collect.Range
import com.google.common.collect.RangeSet
import com.google.common.collect.TreeRangeSet
import fr.sncf.osrd.sim_infra.api.ZoneId
import java.util.TreeMap
import kotlin.math.max
import kotlin.math.min

const val DEFAULT_WORK_SCHEDULE_ID: String = "default work schedule ID"

sealed interface IncrementalConflictResponse

data class ConflictResponse(
    // minimum delay that should be added to the train so that there are no conflicts anymore
    val minDelayWithoutConflicts: Double,
    // Time at which the first conflict happened
    val firstConflictTime: Double,
) : IncrementalConflictResponse

data class NoConflictResponse(
    // maximum delay that can be added to the train without creating any conflict
    val maxDelayWithoutConflicts: Double,
    // minimum begin time of the next requirement that could conflict
    val timeOfNextConflict: Double,
) : IncrementalConflictResponse

// Zone name -> (end time -> Range(start time, end time)).
// The range is partially redundant, but it makes for easier and clearer processing.
typealias ParsedRequirements = Map<ZoneId, TreeMap<Double, Range<Double>>>

/**
 * This class takes a list of requirements as input, and can only be used to compare them to a *new*
 * set of requirements. The initial requirements cannot be modified. Conflicts between initial
 * trains are not tested.
 *
 * In practice, this is used for STDCM, where the initial requirements represent the timetable
 * trains, and new requirements come from the train we are trying to fit in the timetable.
 */
class IncrementalConflictDetector(private val spacingZoneUses: ParsedRequirements) {
    /**
     * Checks for any conflict between the initial requirements and the ones given here as method
     * input. Returns a polymorphic response with different extra data for either case (conflict /
     * no conflict).
     */
    fun analyseConflicts(
        spacingRequirements: List<SpacingRequirement>
    ): IncrementalConflictResponse {
        val minDelayWithoutConflicts = minDelayWithoutConflicts(spacingRequirements)
        if (minDelayWithoutConflicts != 0.0) { // There are initial conflicts
            return ConflictResponse(
                minDelayWithoutConflicts,
                earliestConflictTime(spacingRequirements),
            )
        } else { // There are no initial conflicts
            var maxDelay = Double.POSITIVE_INFINITY
            var timeOfNextConflict = Double.POSITIVE_INFINITY
            for (spacingRequirement in spacingRequirements) {
                val map = spacingZoneUses[spacingRequirement.zone] ?: continue
                val entry = map.higherEntry(spacingRequirement.beginTime) ?: continue
                val nextUse = entry.value.lowerEndpoint()
                maxDelay = min(maxDelay, nextUse - spacingRequirement.endTime)
                timeOfNextConflict = min(timeOfNextConflict, nextUse)
            }
            return NoConflictResponse(maxDelay, timeOfNextConflict)
        }
    }

    /**
     * Returns the earliest time at which there is a conflict (a resource is used by the new train
     * and in the initial requirements).
     */
    private fun earliestConflictTime(spacingRequirements: List<SpacingRequirement>): Double {
        var res = Double.POSITIVE_INFINITY
        for (spacingRequirement in spacingRequirements) {
            val map = spacingZoneUses[spacingRequirement.zone] ?: continue
            val entry = map.higherEntry(spacingRequirement.beginTime) ?: continue
            if (entry.value.lowerEndpoint() > spacingRequirement.endTime) continue
            val firstConflictTime = max(entry.value.lowerEndpoint(), spacingRequirement.beginTime)
            res = min(res, firstConflictTime)
        }
        return res
    }

    /**
     * Returns the minimum amount of delay to add to the new requirements to avoid any conflict. May
     * be infinite. 0 if no conflict.
     */
    private fun minDelayWithoutConflicts(spacingRequirements: List<SpacingRequirement>): Double {
        var minDelay = 0.0
        // We iterate until the requirements fit in the timetable,
        // shifting them later whenever a conflict is detected.
        // We stop once we go for a whole loop without conflict.
        while (true) {
            var hasIncreasedDelay = false
            for (spacingRequirement in spacingRequirements) {
                val map = spacingZoneUses[spacingRequirement.zone] ?: continue

                val requirementStart = minDelay + spacingRequirement.beginTime
                val requirementEnd = minDelay + spacingRequirement.endTime

                val firstEntryStartAfter = map.higherEntry(requirementStart) ?: continue
                if (firstEntryStartAfter.value.lowerEndpoint() >= requirementEnd) continue

                val extraDelay = firstEntryStartAfter.value.upperEndpoint() - requirementStart
                minDelay += extraDelay
                hasIncreasedDelay = true
            }
            // No new conflicts
            if (!hasIncreasedDelay || minDelay.isInfinite()) return minDelay
        }
    }
}

fun generateSpacingZoneUses(requirements: List<Requirements>): ParsedRequirements {
    // We first create RangeSets to handle the overlaps, but then
    // convert them to TreeMaps (`.higherEntry` is extremely convenient here)
    val rangeSets = mutableMapOf<ZoneId, RangeSet<Double>>()
    for (req in requirements) {
        for (spacingReq in req.spacingRequirements) {
            val set = rangeSets.computeIfAbsent(spacingReq.zone) { TreeRangeSet.create() }
            set.add(Range.closedOpen(spacingReq.beginTime, spacingReq.endTime))
        }
    }
    return rangeSets
        .map { range ->
            range.key to TreeMap(range.value.asRanges().associateBy { it.upperEndpoint() })
        }
        .toMap()
}
