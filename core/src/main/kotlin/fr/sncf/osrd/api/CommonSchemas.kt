package fr.sncf.osrd.api

import com.squareup.moshi.Json
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta

data class DirectionalTrackRange(
    @Json(name = "track_section") val trackSection: String,
    var begin: Offset<TrackSection>,
    var end: Offset<TrackSection>,
    val direction: EdgeDirection,
)

data class TrackRange(
    @Json(name = "track_section") val trackSection: String,
    var begin: Offset<TrackSection>,
    var end: Offset<TrackSection>,
)

data class RangeValues<valueT>(
    // List of `n` internal boundaries of the ranges along the path (excluding start and end
    // bounds).
    @Json(name = "boundaries") val internalBoundaries: List<Offset<TravelledPath>> = listOf(),
    // List of `n+1` values associated to the bounded intervals
    val values: List<valueT> = listOf(),
) {
    fun toDistanceRangeMap(
        beginPos: Offset<TravelledPath>,
        endPos: Offset<TravelledPath>,
    ): DistanceRangeMap<valueT> {
        val boundaries = internalBoundaries.toMutableList()
        boundaries.add(0, beginPos)
        boundaries.add(endPos)
        val boundariesSize = boundaries.size
        val valuesSize = values.size
        assert(boundariesSize == valuesSize + 1)
        val rangeMapEntries = mutableListOf<DistanceRangeMap.RangeMapEntry<valueT>>()
        for (i in 0 until valuesSize) {
            rangeMapEntries.add(
                DistanceRangeMap.RangeMapEntry(
                    boundaries[i].distance,
                    boundaries[i + 1].distance,
                    values[i],
                )
            )
        }
        return distanceRangeMapOf(rangeMapEntries)
    }
}

class TrackLocation(val track: String, val offset: Offset<TrackSection>)

class ZoneUpdate(
    val zone: String,
    val time: TimeDelta,
    val position: Offset<TravelledPath>,
    @Json(name = "is_entry") val isEntry: Boolean,
)

class SignalCriticalPosition(
    val signal: String,
    val time: TimeDelta,
    val position: Offset<TravelledPath>,
    val state: String,
)

class RJSRoutingRequirement(
    val route: String,
    @Json(name = "begin_time") val beginTime: TimeDelta,
    val zones: List<RJSRoutingZoneRequirement>,
)

class RJSRoutingZoneRequirement(
    val zone: String,
    @Json(name = "entry_detector") val entryDetector: String,
    @Json(name = "exit_detector") val exitDetector: String,
    val switches: Map<String, String>,
    @Json(name = "end_time") val endTime: TimeDelta,
)

class RJSSpacingRequirement(
    val zone: String,
    @Json(name = "begin_time") val beginTime: TimeDelta,
    @Json(name = "end_time") val endTime: TimeDelta,
)

data class WorkSchedule(
    /** List of affected track ranges */
    @Json(name = "track_ranges") val trackRanges: Collection<TrackRange> = listOf(),
    @Json(name = "start_time") val startTime: TimeDelta,
    @Json(name = "end_time") val endTime: TimeDelta,
)
