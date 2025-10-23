package fr.sncf.osrd.standalone_sim

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.standalone_sim.SimulationScheduleItem
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.interfaces.getRouteAbsolutePathEnd
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainStop
import fr.sncf.osrd.signaling.etcs_level2.ETCS_LEVEL2
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.kilometersPerHour
import fr.sncf.osrd.utils.units.meters

/**
 * Simple internal class representing a stop with safety speed. Makes the function logic more
 * straightforward.
 */
private data class SafetySpeedStop(val offset: Offset<TrainPath>, val isShortSlip: Boolean)

/**
 * Compute safety speed ranges, areas where the train has a lower speed limit because of a scheduled
 * stop. For details, see https://osrd.fr/en/docs/reference/design-docs/timetable/#modifiable-fields
 * (or google "VISA (VItesse Sécuritaire d'Approche)" for resources in French)
 */
fun makeSafetySpeedRanges(
    infra: FullInfra,
    trainPath: TrainPath,
    schedule: List<SimulationScheduleItem>,
    signalingRanges: DistanceRangeMap<String>,
): DistanceRangeMap<Speed> {
    val rawInfra = infra.rawInfra
    val signalOffsets = getSignalOffsets(infra, trainPath)

    val stopsWithSafetySpeed =
        schedule
            .filter {
                it.receptionSignal.isStopOnClosedSignal &&
                    // ETCS signaling system already handles Safety Approach Speed via braking
                    // curves
                    !isStopInSignalingSystemRange(it.pathOffset, signalingRanges, ETCS_LEVEL2.id)
            }
            .map {
                SafetySpeedStop(
                    it.pathOffset,
                    it.receptionSignal == RJSTrainStop.RJSReceptionSignal.SHORT_SLIP_STOP,
                )
            }
            .toMutableList()

    // Last buffer-stop is handled via ETCS braking curves if the last stop is handled by ETCS
    // signaling system
    if (
        schedule.isNotEmpty() &&
            !isStopInSignalingSystemRange(
                schedule.last().pathOffset,
                signalingRanges,
                ETCS_LEVEL2.id,
            )
    ) {
        makeEndOfPathStop(rawInfra, trainPath, signalOffsets)?.let { stopsWithSafetySpeed.add(it) }
    }

    val res = distanceRangeMapOf<Speed>()
    for (stop in stopsWithSafetySpeed) {
        // Currently, safety speed is applied to the next signal no matter the sight distance
        // TODO: should we compute the minimum when adding a speed limit?
        val nextSignalOffset = signalOffsets.first { it >= stop.offset }.distance
        res.put(
            lower = nextSignalOffset - 200.meters,
            upper = nextSignalOffset,
            value = 30.kilometersPerHour,
        )
        if (stop.isShortSlip) {
            res.put(
                lower = nextSignalOffset - 100.meters,
                upper = nextSignalOffset,
                value = 10.kilometersPerHour,
            )
        }
    }
    // Safety speed areas may extend outside the path
    return res.subMap(0.meters, trainPath.getLength())
}

/** Check if a given stop is in a range of a given signaling system. */
private fun isStopInSignalingSystemRange(
    stopOffset: Offset<TrainPath>,
    signalingRanges: DistanceRangeMap<String>,
    signalingSystem: String,
): Boolean {
    return (signalingRanges.get(stopOffset.distance) == signalingSystem)
}

/**
 * Create a safety speed range at the end of the last route, either short slip or normal stop
 * depending on whether it ends at a buffer stop.
 */
private fun makeEndOfPathStop(
    infra: RawSignalingInfra,
    trainPath: TrainPath,
    signalOffsets: List<Offset<TrainPath>>,
): SafetySpeedStop? {
    val lastRouteExit = infra.getRouteExit(trainPath.getRoutes().last().value)
    val isBufferStop = infra.isBufferStop(lastRouteExit.value)
    if (isBufferStop) return SafetySpeedStop(signalOffsets.last(), true)
    return null
}

/** Return the offsets of block-delimiting signals on the path. */
private fun getSignalOffsets(infra: FullInfra, trainPath: TrainPath): List<Offset<TrainPath>> {
    val res = mutableListOf<Offset<TrainPath>>()
    val rawInfra = infra.rawInfra
    val signalingInfra = infra.loadedSignalInfra
    var prevZonePathsLength = 0.meters
    for (zonePathRange in trainPath.getZonePaths()) {
        val zonePath = zonePathRange.value
        val signalPositions = rawInfra.getSignalPositions(zonePath)
        val signals = rawInfra.getSignals(zonePath)
        for ((signal, signalPosition) in signals zip signalPositions) {
            val isDelimiter =
                signalingInfra.getLogicalSignals(signal).any(signalingInfra::isBlockDelimiter)
            if (isDelimiter) {
                res.add(zonePathRange.offsetToTrainPath(signalPosition))
            }
        }
        prevZonePathsLength += rawInfra.getZonePathLength(zonePath).distance
    }
    // Add one "signal" at the end of the last route no matter what.
    // There must be either a signal or a buffer stop, on which we may end safety speed ranges.
    val lastRouteRange = trainPath.getRoutes().last()
    res.add(lastRouteRange.getRouteAbsolutePathEnd(rawInfra))

    return res.filter { it.distance >= 0.meters }
}
