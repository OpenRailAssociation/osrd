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
 * Decides what trains are allowed to do, once per tick, before they move.
 *
 * Basically adds constraints dynamically based on other inputs (like stopping before a square at an intersection)
 * Could be nice to have this be linkable to a chain of regulators in the future?
 */
fun interface Regulator {
    fun regulate()

    companion object {
        val NONE: Regulator = Regulator {}
    }
}

sealed interface TimetableResult {
    val states: List<List<TrainState>>

    data class Success(override val states: List<List<TrainState>>) : TimetableResult

    // To debug infinite loops
    data class Stalled(
        override val states: List<List<TrainState>>,
        val blocked: List<Int>,
    ) : TimetableResult
}

fun runTrains(
    trains: List<ScheduledTrain>,
    timeStep: PreciseDuration,
    regulator: Regulator = Regulator.NONE,
): TimetableResult {
    require(timeStep > 0.microseconds) { "the time step must be strictly positive" }
    for (train in trains) {
        require(train.departure >= 0.microseconds) { "a train can't depart before the timetable" }
    }

    var clock = 0.microseconds
    while (trains.any { !it.simulator.isFinished }) {
        var tickEnd = clock + timeStep

        if (trains.none { hasDeparted(it, tickEnd) && !it.simulator.isFinished }) {
            val nextDeparture =
                trains.filter { !it.simulator.isFinished }.minOfOrNull { it.departure } ?: break
            clock = nextDeparture
            tickEnd = clock + timeStep
        }

        val positionsBefore = trains.map { it.simulator.state.position }

        regulator.regulate()

        for (train in trains) {
            if (!hasDeparted(train, tickEnd)) continue
            train.simulator.advanceUntil(tickEnd - train.departure)
        }

        val underWay =
            trains.indices.filter {
                hasDeparted(trains[it], tickEnd) && !trains[it].simulator.isFinished
            }
        val moved = trains.indices.any { trains[it].simulator.state.position > positionsBefore[it] }
        if (underWay.isNotEmpty() && !moved) {
            return TimetableResult.Stalled(trains.map { it.simulator.states }, underWay)
        }

        clock = tickEnd
    }

    return TimetableResult.Success(trains.map { it.simulator.states })
}

private fun hasDeparted(train: ScheduledTrain, tickEnd: PreciseDuration): Boolean =
    tickEnd > train.departure
