package fr.sncf.osrd.conflicts

import fr.sncf.osrd.sim_infra.api.LogicalSignalId
import fr.sncf.osrd.sim_infra.api.Path
import fr.sncf.osrd.utils.units.Offset

interface IncrementalRequirementCallbacks {
    // if the train never arrives in range, +inf is returned
    // a range is used rather than a point to properly handle the train appearing and disappearing
    fun arrivalTimeInRange(pathBeginOff: Offset<Path>, pathEndOff: Offset<Path>): Double

    // the departure time from a given location, which has to take into account train length.
    // this is used to compute zone occupancy. if the train never leaves a location, +inf is returned
    fun departureTimeFromRange(pathBeginOff: Offset<Path>, pathEndOff: Offset<Path>): Double

    // the end time of the train
    fun endTime(): Double

    fun clone(): IncrementalRequirementCallbacks
}


data class PathSignal(
    val signal: LogicalSignalId,
    val pathOffset: Offset<Path>,
    // when a signal is between blocks, prefer the index of the first block
    val minBlockPathIndex: Int,
)
