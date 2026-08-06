package fr.sncf.osrd.trainsim

import fr.sncf.osrd.conflicts.RoutingZoneConfig
import fr.sncf.osrd.envelope_sim.SimpleContextBuilder.makeSimpleContext
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.sim_infra.api.Detector
import fr.sncf.osrd.sim_infra.api.DirDetectorId
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test

class IntersectionRegulatorTest {
    private val timeStep = 2.0
    private val pathLength = 10_000.0
    private val trainLength = 100.0.meters

    private fun makeContext(length: Double = pathLength) = makeSimpleContext(length, 0.0, timeStep)

    private fun makeSimulator(
        length: Double = pathLength,
        constraints: List<Constraint> = listOf(speedLimit(length)),
    ) = TrainSimulator(makeContext(length), constraints)

    private fun speedLimit(length: Double = pathLength, limit: Double = 20.0) =
        SpeedLimitedZone(0.micrometers, length.meters, limit.metersPerSecond)

    private fun offset(meters: Double): Offset<PhysicsPath> = Offset(Distance.fromMeters(meters))

    private fun detector(index: UInt): DirDetectorId =
        DirDetectorId(StaticIdx<Detector>(index), Direction.INCREASING)

    private val westToEast = RoutingZoneConfig(detector(0u), detector(1u), mapOf("switch" to "W_E"))
    private val westToNorth =
        RoutingZoneConfig(detector(0u), detector(2u), mapOf("switch" to "W_N"))

    private val northToSouth =
        RoutingZoneConfig(detector(10u), detector(11u), mapOf("cross" to "N_S"))
    private val eastToWest =
        RoutingZoneConfig(detector(12u), detector(13u), mapOf("cross" to "E_W"))

    // For simplicity, any intersection created for these tests always starts and ends at the same
    // point
    private fun intersection(config: RoutingZoneConfig) =
        PathIntersection(
            zone = StaticIdx(0u),
            zoneEntry = offset(4_000.0),
            zoneEnd = offset(4_200.0),
            approachStart = offset(2_500.0),
            config = config,
        )

    private fun regulatedTrain(
        config: RoutingZoneConfig,
        departure: PreciseDuration = 0.microseconds,
        constraints: List<Constraint> = listOf(speedLimit()),
    ) =
        RegulatedTrain(
            simulator = makeSimulator(constraints = constraints),
            departure = departure,
            baseConstraints = constraints,
            intersections = listOf(intersection(config)),
            length = trainLength,
        )

    /*
     *   train 1 (west->east)    -- approach -- [ zone ] -- through -->
     *   train 2 (west->north)  -- approach -- [ held at zoneEntry ] -- [ zone ] -- through -->
     *                                                                 ^
     *                                     train 1 clears zoneEnd, train 2 is released
     */
    @Test
    fun testSecondTrainWaitsForTheFirstAtAnIncompatibleIntersection() {
        val first = regulatedTrain(westToEast)
        val second = regulatedTrain(westToNorth)
        val regulator = IntersectionRegulator(listOf(first, second))

        val result = runTrains(regulator.scheduledTrains(), timeStep.seconds, regulator)
        val states = assertIs<TimetableResult.Success>(result).states

        val zoneEntry = intersection(westToEast).zoneEntry.toPrecise()
        val zoneEnd = intersection(westToEast).zoneEnd.toPrecise()
        val releaseTime = states[0].first { it.position - trainLength >= zoneEnd }.time
        val earliestEntry = releaseTime saturatedMinus timeStep.seconds

        for (state in states[1]) {
            if (state.position > zoneEntry) {
                assertTrue(
                    state.time >= earliestEntry,
                    "second train entered the intersection at ${state.time}, " +
                        "well before the first train released it at $releaseTime",
                )
            }
        }
        assertTrue(states[1].any { it.position > zoneEntry })
    }

    /*
     * Same switch config, no particular reservation/hold since they can just go one after another.
     *
     *   train 1 (west->east)  -- approach -- [ ------- zone ------- ] -- through -->
     *   train 2 (west->east)  -- approach -- [ ------- zone ------- ] -- through -->
     */
    @Test
    fun testCompatibleTrainsCrossTheIntersectionTogetherWithoutWaiting() {
        fun makeTrains() = listOf(regulatedTrain(westToEast), regulatedTrain(westToEast))

        val regulator = IntersectionRegulator(makeTrains())
        val together =
            assertIs<TimetableResult.Success>(
                    runTrains(regulator.scheduledTrains(), timeStep.seconds, regulator)
                )
                .states

        val alone =
            makeTrains().map {
                it.simulator.runToEnd()
                it.simulator.states
            }

        assertEquals(alone, together)
    }

    /*
     *   train 1 (west->east)    -- approach -- [ zone ] -- through -->
     *                                                             ...1_500s gap...
     *   train 2 (west->north)                                        -- approach -- [ zone ] -- through -->
     */
    @Test
    fun testIncompatibleTrainsDoNotWaitWhenWellSeparatedInTime() {
        val departureGap = 1_500.0.seconds

        fun makeTrains() =
            listOf(
                regulatedTrain(westToEast),
                regulatedTrain(westToNorth, departure = departureGap),
            )

        val regulator = IntersectionRegulator(makeTrains())
        val together =
            assertIs<TimetableResult.Success>(
                    runTrains(regulator.scheduledTrains(), timeStep.seconds, regulator)
                )
                .states

        val alone =
            makeTrains().map {
                it.simulator.runToEnd()
                it.simulator.states
            }

        assertEquals(alone, together)
    }

    /*
     * Cross switch test. Trains are spaced to make sure the switch has to move between each of them.
     *
     *   train 0 (north->south)  -- [ zone ] -->
     *   train 1 (east->west)          [held] -- [ zone ] -->
     *   train 2 (north->south)                          [ zone ] -->
     *   train 3 (east->west)                                       [ zone ] -->
     */
    @Test
    fun testFourTrainsAlternateThroughACrossSwitch() {
        val configs = listOf(northToSouth, eastToWest, northToSouth, eastToWest)
        // Space the trains so that the switch really has to go back and forth.
        // We don't want the two trains going north->south and east->west to move before the
        // switch moves.
        val departures = listOf(0.0, 20.0, 130.0, 220.0)
        val trains =
            configs.zip(departures).map { (config, departure) ->
                regulatedTrain(config, departure = departure.seconds)
            }
        val regulator = IntersectionRegulator(trains)

        val result = runTrains(regulator.scheduledTrains(), timeStep.seconds, regulator)
        val states = assertIs<TimetableResult.Success>(result).states

        val zoneEnd = intersection(northToSouth).zoneEnd.toPrecise()
        val insideCrossing = intersection(northToSouth).zoneEntry.toPrecise() + 10.0.meters

        fun globalTimeOf(train: Int, state: TrainState) = state.time + trains[train].departure

        for (i in 0 until trains.size - 1) {
            val releaseTime =
                globalTimeOf(i, states[i].first { it.position - trainLength >= zoneEnd })
            val earliestEntry = releaseTime saturatedMinus timeStep.seconds

            for (state in states[i + 1]) {
                if (state.position > insideCrossing) {
                    val entryTime = globalTimeOf(i + 1, state)
                    assertTrue(
                        entryTime >= earliestEntry,
                        "train ${i + 1} entered the crossing at $entryTime, " +
                            "before train $i released it at $releaseTime",
                    )
                }
            }
        }
        for ((i, trainStates) in states.withIndex()) {
            assertTrue(
                trainStates.any { it.position > insideCrossing },
                "train $i never reached it",
            )
        }
    }
}
