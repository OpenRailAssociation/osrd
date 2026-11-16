package fr.sncf.osrd.trainsim

import fr.sncf.osrd.envelope_sim.SimpleContextBuilder.makeSimpleContext
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlocks
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.sim_infra.api.getLogicalSignalName
import fr.sncf.osrd.utils.Helpers
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue
import org.junit.jupiter.api.Test

class SignalingRegulatorTest {
    private val infra = Helpers.smallInfra

    private fun path(vararg routes: String) =
        buildTrainPathFromBlocks(
            infra.rawInfra,
            infra.blockInfra,
            Helpers.getBlocksOnRoutes(infra, routes.toList()),
            listOf(),
            routes.map { infra.rawInfra.getRouteFromName(it) },
        )

    private val trainLength = 100.0.meters
    private val timeStep = 2.0

    private fun train(
        path: TrainPath,
        head: PreciseDistance = 0.micrometers,
        speedLimit: Double = 20.0,
        departure: PreciseDuration = 0.microseconds,
    ): SignaledTrain {
        val pathLength = path.getLength().distance.meters
        val constraints =
            listOf(SpeedLimitedZone(0.micrometers, pathLength.meters, speedLimit.metersPerSecond))
        return SignaledTrain(
            simulator =
                TrainSimulator(
                    makeSimpleContext(pathLength, 0.0, timeStep),
                    constraints,
                    TrainState.zero.copy(position = head),
                ),
            departure = departure,
            path = path,
            length = trainLength,
            baseConstraints = constraints,
        )
    }

    @Test
    fun testFiveTrainsQueueBehindTheFirstOneParkedAtTheEnd() {
        val path = path("rt.buffer_stop.1->DA0", "rt.DA0->DA5")
        val pathZones = path.getZoneRanges()
        val trains = (0 until 5).map { train(path, departure = (120.0 * it).seconds) }
        val regulator = SignalingRegulator(infra, trains)

        val checked = Regulator {
            regulator.regulate()
            val spans =
                trains
                    .map { it.simulator.state.position }
                    .filter { it > 0.micrometers }
                    .map { it - trainLength..it }
            for (i in spans.indices) for (j in 0 until i) {
                assertTrue(
                    spans[i].endInclusive <= spans[j].start ||
                        spans[j].endInclusive <= spans[i].start,
                    "trains overlap: $spans",
                )
            }
        }

        val result = runTrains(regulator.scheduledTrains(), timeStep.seconds, checked)
        val stalled = assertIs<TimetableResult.Stalled>(result)

        assertEquals(listOf(1, 2, 3, 4), stalled.blocked)
        assertTrue(trains[0].simulator.isFinished)
        val pathLength = path.getLength().distance.meters
        assertEquals(
            (1..4).map { (pathLength - (trainLength.meters + 30.0) * it).meters },
            trains.drop(1).map { it.simulator.state.position },
        )
        assertTrue(trains.drop(1).all { it.simulator.state.speed == 0.micrometersPerSecond })

        val occupied =
            trains
                .flatMap { occupiedZones(pathZones, it.simulator.state.position, trainLength) }
                .toSet()
        val aspects =
            signalStates(infra, path, occupied).entries.associate {
                infra.rawInfra.getLogicalSignalName(it.key)!! to it.value.getEnum("aspect")
            }
        assertEquals(
            mapOf(
                "SA0" to "VL",
                "SA6_1" to "VL",
                "SA6_2" to "VL",
                "SA6_3" to "VL",
                "SA6_4" to "A",
                "SA6_5" to "S",
                "SA5" to "A",
            ),
            aspects,
        )
    }
}
