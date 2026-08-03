package fr.sncf.osrd.trainsim

/**
 * A train of a timetable, and when it leaves.
 *
 * [departure] is an offset from the start of the timetable. The train's own states remain in its
 * local time frame, which starts at zero when it departs.
 */
data class ScheduledTrain(
    val simulator: TrainSimulator,
    val departure: PreciseDuration = 0.microseconds,
)

/**
 * Runs every train of a timetable, advancing them all on a shared clock.
 *
 * Returns the states each train went through, in the same order as [trains].
 */
fun runTrains(
    trains: List<ScheduledTrain>,
    timeStep: PreciseDuration,
): List<List<TrainState>> {
    require(timeStep > 0.microseconds) { "the time step must be strictly positive" }
    for (train in trains) {
        require(train.departure >= 0.microseconds) { "a train can't depart before the timetable" }
    }

    var clock = 0.microseconds
    while (trains.any { !it.simulator.isFinished }) {
        val tickEnd = clock + timeStep

        for (train in trains) {
            if (tickEnd <= train.departure) continue
            train.simulator.advanceUntil(tickEnd - train.departure)
        }

        clock = tickEnd
    }

    return trains.map { it.simulator.states }
}
