package fr.sncf.osrd.conflicts

import fr.sncf.osrd.sim_infra.api.LogicalSignalId
import fr.sncf.osrd.utils.units.Offset

interface IncrementalRequirementCallbacks {
    // if the train never arrives in range, +inf is returned
    // a range is used rather than a point to properly handle the train appearing and disappearing
    fun arrivalTimeInRange(
        pathBeginOff: Offset<TravelledPath>,
        pathEndOff: Offset<TravelledPath>
    ): Double

    // the departure time from a given location, which has to take into account train length.
    // this is used to compute zone occupancy. if the train never leaves a location, +inf is
    // returned
    fun departureTimeFromRange(
        pathBeginOff: Offset<TravelledPath>,
        pathEndOff: Offset<TravelledPath>
    ): Double

    val currentTime: Double
    val currentPathOffset: Offset<TravelledPath>

    val simulationComplete: Boolean

    fun clone(): IncrementalRequirementCallbacks

    fun maxSpeedInRange(
        pathBeginOff: Offset<TravelledPath>,
        pathEndOff: Offset<TravelledPath>
    ): Double

    // departure time from a given stop. if the train never gets to a stop, +inf is returned
    fun departureFromStop(stopOffset: Offset<TravelledPath>): Double
}

data class PathSignal(
    val signal: LogicalSignalId,
    val pathOffset: Offset<TravelledPath>,
    // when a signal is between blocks, prefer the index of the first block
    val minBlockPathIndex: Int,
)
