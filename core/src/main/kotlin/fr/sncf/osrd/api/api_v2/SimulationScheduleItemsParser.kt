package fr.sncf.osrd.api.api_v2

import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.OPEN
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop.RJSReceptionSignal.STOP
import fr.sncf.osrd.utils.units.TimeDelta
import java.lang.Long.min
import mu.KotlinLogging

val simulationScheduleItemParserLogger = KotlinLogging.logger {}

/**
 * Merge consecutive schedule items which are at the same location, i.e. have the same path offset.
 * Merge rules for a group of schedule items are as follows:
 * - arrival is the minimum value of all the concerned schedule items, null if they are all null.
 * - stopFor is the sum of all the stopFor values of all the schedule items, null if they are all
 *   null.
 * - receptionSignal is the most constrained of all schedule item's receptionSignal
 */
fun parseRawSimulationScheduleItems(
    rawSimulationScheduleItems: List<SimulationScheduleItem>
): List<SimulationScheduleItem> {
    val simulationScheduleItems = mutableListOf<SimulationScheduleItem>()
    var i = 0
    while (i < rawSimulationScheduleItems.size) {
        val pathOffset = rawSimulationScheduleItems[i].pathOffset
        var arrival = rawSimulationScheduleItems[i].arrival
        var stopFor = rawSimulationScheduleItems[i].stopFor
        var receptionSignal = rawSimulationScheduleItems[i].receptionSignal
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
            val nextStopFor = rawSimulationScheduleItems[i + 1].stopFor
            stopFor =
                when {
                    nextStopFor != null && stopFor != null -> stopFor + nextStopFor
                    nextStopFor != null -> nextStopFor
                    else -> stopFor
                }
            val nextReceptionSignal = rawSimulationScheduleItems[i + 1].receptionSignal
            receptionSignal =
                if (receptionSignal == SHORT_SLIP_STOP || nextReceptionSignal == SHORT_SLIP_STOP)
                    SHORT_SLIP_STOP
                else if (receptionSignal == STOP || nextReceptionSignal == STOP) STOP else OPEN
            i++
        }
        val newItem = SimulationScheduleItem(pathOffset, arrival, stopFor, receptionSignal)
        if (simulationScheduleItems.lastOrNull() == newItem) {
            simulationScheduleItemParserLogger.warn { "duplicated schedule items: $newItem" }
        } else {
            simulationScheduleItems.add(newItem)
        }
        i++
    }
    return simulationScheduleItems.sortedBy { it.pathOffset }
}
