package fr.sncf.osrd.conflicts

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.utils.units.Offset

interface IncrementalRequirementCallbacks {
    // if the train never arrives in range, +inf is returned
    // a range is used rather than a point to properly handle the train appearing and disappearing
    fun arrivalTimeInRange(pathBeginOff: Offset<TrainPath>, pathEndOff: Offset<TrainPath>): Double

    // the departure time from a given location, which has to take into account train length.
    // this is used to compute zone occupancy. if the train never leaves a location, +inf is
    // returned
    fun departureTimeFromRange(
        pathBeginOff: Offset<TrainPath>,
        pathEndOff: Offset<TrainPath>,
    ): Double

    val currentTime: Double
    val currentPathOffset: Offset<TrainPath>

    val simulationComplete: Boolean

    fun clone(): IncrementalRequirementCallbacks

    fun maxSpeedInRange(pathBeginOff: Offset<TrainPath>, pathEndOff: Offset<TrainPath>): Double

    // departure time from a given stop. if the train never gets to a stop, +inf is returned
    fun departureFromStop(stopOffset: Offset<TrainPath>): Double

    fun getRawEnvelopeIfSingle(): Envelope?
}
