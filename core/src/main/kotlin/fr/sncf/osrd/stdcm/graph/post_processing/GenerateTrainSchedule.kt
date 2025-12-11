package fr.sncf.osrd.stdcm.graph.post_processing

import fr.sncf.osrd.api.PathItem
import fr.sncf.osrd.api.RangeValues
import fr.sncf.osrd.api.ScheduleItem
import fr.sncf.osrd.api.TrackOffset
import fr.sncf.osrd.api.TrainSchedule
import fr.sncf.osrd.api.standalone_sim.AllowanceDistribution
import fr.sncf.osrd.api.standalone_sim.TrainScheduleOptions
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.offsetToUndirected
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.stdcm.graph.STDCMGraph
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta
import fr.sncf.osrd.utils.units.seconds
import java.time.Duration.ofSeconds

fun generateTrainSchedule(
    graph: STDCMGraph,
    path: TrainPath,
    timePoints: List<FixedTimePoint>,
    departureTime: Double,
): TrainSchedule {
    val timedPathItems = generateTimedPathItems(graph.rawInfra, path, timePoints)
    val path = timedPathItems.mapIndexed { index, it -> it.toPathItem(index) }
    val schedule = timedPathItems.mapIndexedNotNull { index, it -> it.toScheduleItem(index) }
    val startTime = graph.referenceTime.plus(ofSeconds(departureTime.toLong()))

    val res =
        TrainSchedule(
            trainName = "stdcm output",
            labels = listOf(),
            // We don't have the RS name, and in fact we may not have any that matches the towed RS
            // parameters. We need to create a matching RS and edit its name here.
            rollingStockName = "EDIT_ROLLING_STOCK_NAME_HERE",
            startTime = startTime,
            schedule = schedule,
            margins = RangeValues(),
            initialSpeed = 0,
            comfort = Comfort.STANDARD,
            path = path,
            constraintDistribution = AllowanceDistribution.STANDARD,
            speedLimitTag = graph.tag,
            powerRestrictions = listOf(),
            options = TrainScheduleOptions(false, null),
            mainCategory = null,
            subCategory = null,
        )

    return res
}

/** Path element. Keep track of a location, may also contain time data. */
private data class TimedPathItem(
    val location: TrackOffset,
    val offset: Offset<TrainPath>,
    val time: TimeDelta?,
    val stopDuration: Duration?,
) {
    fun toPathItem(index: Int): PathItem {
        return PathItem(id = index.toString(), location = location)
    }

    fun toScheduleItem(index: Int): ScheduleItem? {
        return time?.let {
            ScheduleItem(
                at = index.toString(),
                arrival = time,
                stopFor = stopDuration,
                receptionSignal = SHORT_SLIP_STOP,
            )
        }
    }
}

/** Generates all the points, for either the path (one per track) or the scheduled points. */
private fun generateTimedPathItems(
    rawInfra: RawInfra,
    path: TrainPath,
    timePoints: List<FixedTimePoint>,
): List<TimedPathItem> {
    val items = mutableListOf<TimedPathItem>()

    // Add one point per track, to make sure the path is identical
    for (trackRange in path.getTrackSections()) {
        val trackName = rawInfra.getTrackSectionName(trackRange.value.value)
        val offset = trackRange.objectBegin
        items.add(
            TimedPathItem(
                location =
                    TrackOffset(track = trackName, offset = trackRange.offsetToUndirected(offset)),
                offset = trackRange.pathBegin,
                time = null,
                stopDuration = null,
            )
        )
    }

    // Add one point per timed location
    for (p in timePoints) {
        val trackPosition = path.getTrackLocationAtOffset(p.offset)
        val trackName = rawInfra.getTrackSectionName(trackPosition.trackId)
        val offset = trackPosition.offset
        items.add(
            TimedPathItem(
                location = TrackOffset(track = trackName, offset = offset),
                offset = p.offset,
                time = p.time.seconds,
                stopDuration = p.stopTime?.seconds,
            )
        )
    }

    // Sort the path items, and pick the ones that has time data when they overlap
    return items
        .groupBy { it.offset }
        .values
        .map { group -> group.firstOrNull { it.time != null } ?: group.first() }
        .sortedBy { it.offset }
}
