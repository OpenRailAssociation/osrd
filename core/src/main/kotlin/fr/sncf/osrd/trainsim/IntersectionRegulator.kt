package fr.sncf.osrd.trainsim

class RegulatedTrain(
    val simulator: TrainSimulator,
    val departure: PreciseDuration = 0.microseconds,
    val baseConstraints: List<Constraint>,
    val intersections: List<PathIntersection>,
    val length: PreciseDistance,
) {
    private val holds = intersections.associateWith { HoldAt(it.zoneEntry.toPrecise()) }

    internal fun holdBefore(intersection: PathIntersection): Constraint =
        holds.getValue(intersection)

    internal fun tailPosition(): PreciseDistance = simulator.state.position - length
}

class IntersectionRegulator(
    private val trains: List<RegulatedTrain>,
    private val table: ReservationTable = ReservationTable(),
) : Regulator {
    fun scheduledTrains(): List<ScheduledTrain> = trains.map {
        ScheduledTrain(it.simulator, it.departure)
    }

    override fun regulate() {
        // Flush reservations that are no longer valid
        for ((index, train) in trains.withIndex()) {
            val gone = train.simulator.isFinished
            for (intersection in train.intersections) {
                if (gone || train.tailPosition() >= intersection.zoneEnd.toPrecise()) {
                    table.release(intersection.zone, index)
                }
            }
        }

        for ((index, train) in trains.withIndex()) {
            if (train.simulator.isFinished) {
                train.simulator.constraints = train.baseConstraints
                continue
            }
            train.simulator.constraints = train.baseConstraints + holdsFor(index, train)
        }
    }

    private fun holdsFor(index: Int, train: RegulatedTrain): List<Constraint> {
        val head = train.simulator.state.position

        for (intersection in train.intersections) {
            if (train.tailPosition() >= intersection.zoneEnd.toPrecise()) continue
            if (head < intersection.approachStart.toPrecise()) continue

            if (!table.request(intersection.zone, intersection.config, index)) {
                return listOf(train.holdBefore(intersection))
            }
        }

        return listOf()
    }
}
