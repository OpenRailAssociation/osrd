package fr.sncf.osrd.api

import fr.sncf.osrd.api.standalone_sim.SimulationPowerRestrictionItem
import fr.sncf.osrd.api.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.api.standalone_sim.StopDetails
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.OPEN
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.STOP
import fr.sncf.osrd.utils.OffsetRangeMap
import fr.sncf.osrd.utils.offsetRangeMapOf
import fr.sncf.osrd.utils.units.TimeDelta
import java.lang.Long.min
import mu.KotlinLogging

val simulationScheduleItemParserLogger = KotlinLogging.logger {}

/**
 * Merge consecutive schedule items which are at the same location, i.e. have the same path offset.
 * Merge rules for a group of schedule items are as follows:
 * - arrival is the minimum value of all the concerned schedule items, null if they are all null.
 * - stop duration is the sum of all the stop duration values of all the schedule items, null if
 *   they are all null.
 * - receptionSignal is the most constrained of all schedule item's receptionSignal
 * - isBacktracking is true if at least one of the items is backtracking
 */
fun parseRawSimulationScheduleItems(
    rawSimulationScheduleItems: List<SimulationScheduleItem>
): List<SimulationScheduleItem> {
    val simulationScheduleItems = mutableListOf<SimulationScheduleItem>()
    var i = 0
    while (i < rawSimulationScheduleItems.size) {
        val pathOffset = rawSimulationScheduleItems[i].pathOffset
        var arrival = rawSimulationScheduleItems[i].arrival
        var stopDetails = rawSimulationScheduleItems[i].stopDetails
        while (
            i < rawSimulationScheduleItems.size - 1 &&
                rawSimulationScheduleItems[i + 1].pathOffset == pathOffset
        ) {
            val nextArrival = rawSimulationScheduleItems[i + 1].arrival
            arrival =
                when {
                    nextArrival != null && arrival != null ->
                        TimeDelta(min(arrival.milliseconds, nextArrival.milliseconds))
                    nextArrival != null -> nextArrival
                    else -> arrival
                }

            val nextStopDetails = rawSimulationScheduleItems[i + 1].stopDetails
            if (nextStopDetails != null && stopDetails != null) {
                var receptionSignal = stopDetails.receptionSignal
                val nextReceptionSignal = nextStopDetails.receptionSignal
                receptionSignal =
                    if (
                        receptionSignal == SHORT_SLIP_STOP || nextReceptionSignal == SHORT_SLIP_STOP
                    )
                        SHORT_SLIP_STOP
                    else if (receptionSignal == STOP || nextReceptionSignal == STOP) STOP else OPEN
                stopDetails =
                    StopDetails(
                        stopDetails.duration + nextStopDetails.duration,
                        receptionSignal,
                        stopDetails.isBacktracking || nextStopDetails.isBacktracking,
                    )
            } else if (nextStopDetails != null) {
                stopDetails = nextStopDetails
            }
            i++
        }
        val newItem = SimulationScheduleItem(pathOffset, arrival, stopDetails)
        if (simulationScheduleItems.lastOrNull() == newItem) {
            simulationScheduleItemParserLogger.warn { "duplicated schedule items: $newItem" }
        } else {
            simulationScheduleItems.add(newItem)
        }
        i++
    }
    return simulationScheduleItems.sortedBy { it.pathOffset }
}

fun parsePowerRestrictions(
    powerRestrictions: List<SimulationPowerRestrictionItem>
): OffsetRangeMap<PhysicsPath, String> {
    val res = offsetRangeMapOf<PhysicsPath, String>()
    for (entry in powerRestrictions) {
        res.put(entry.from, entry.to, entry.value)
    }
    return res
}
