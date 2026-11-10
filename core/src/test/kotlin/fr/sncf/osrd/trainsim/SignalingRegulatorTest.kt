package fr.sncf.osrd.trainsim

import fr.sncf.osrd.envelope_sim.SimpleContextBuilder.makeSimpleContext
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlocks
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.sim_infra.api.getLogicalSignalName
import fr.sncf.osrd.standalone_sim.pathSignals
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

    private val trainPath = path("rt.buffer_stop.3->DB0", "rt.DB0->DA6")
    private val zones = trainPath.getZoneRanges()
    private val trainLength = 100.0.meters
    private val timeStep = 2.0

    private fun signalPosition(name: String, path: TrainPath = trainPath) =
        pathSignals(path, infra.blockInfra)
            .single { infra.rawInfra.getLogicalSignalName(it.signal) == name }
            .pathOffset
            .toPrecise()

    private fun train(
        head: PreciseDistance = 0.micrometers,
        speedLimit: Double = 20.0,
        departure: PreciseDuration = 0.microseconds,
        path: TrainPath = trainPath,
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

    private fun holds(train: SignaledTrain) =
        train.simulator.constraints.filterIsInstance<HoldAt>().map { it.position }

    @Test
    fun testFiveTrainsQueueBehindTheFirstOneParkedAtTheEnd() {
        val path = path("rt.buffer_stop.1->DA0", "rt.DA0->DA5")
        val pathZones = path.getZoneRanges()
        val trains = (0 until 5).map { train(departure = (120.0 * it).seconds, path = path) }
        val regulator = SignalingRegulator(infra, trains)

        val checked = Regulator {
            regulator.regulate()
            val occupancies = trains.map {
                occupiedZones(pathZones, it.simulator.state.position, trainLength).toSet()
            }
            for (i in trains.indices) for (j in 0 until i) {
                assertTrue(
                    occupancies[i].intersect(occupancies[j]).isEmpty(),
                    "trains $j and $i are on the same zone: ${trains.map { it.simulator.state }}",
                )
            }
        }

        val result = runTrains(regulator.scheduledTrains(), timeStep.seconds, checked)
        val stalled = assertIs<TimetableResult.Stalled>(result)

        assertEquals(listOf(1, 2, 3, 4), stalled.blocked)
        assertTrue(trains[0].simulator.isFinished)
        assertEquals(
            listOf("SA6_5", "SA6_4", "SA6_3", "SA6_2").map { signalPosition(it, path) },
            trains.drop(1).map { it.simulator.state.position },
        )
        assertTrue(trains.drop(1).all { it.simulator.state.speed == 0.micrometersPerSecond })

        val occupied =
            trains
                .flatMap {
                    occupiedZones(pathZones, it.simulator.state.position, trainLength)
                }
                .toSet()
        val aspects =
            signalStates(infra, path, occupied).entries.associate {
                infra.rawInfra.getLogicalSignalName(it.key)!! to it.value.getEnum("aspect")
            }
        assertEquals(
            mapOf(
                "SA0" to "A",
                "SA6_1" to "S",
                "SA6_2" to "S",
                "SA6_3" to "S",
                "SA6_4" to "S",
                "SA6_5" to "S",
                "SA5" to "A",
            ),
            aspects,
        )
    }

    @Test
    fun testFiveTrainsStartingInARowQueueBehindTheFirstOne() {
        val path = path("rt.buffer_stop.1->DA0", "rt.DA0->DA5")
        val heads = listOf(8500.0, 6900.0, 5300.0, 3700.0, 1700.0)
        val trains = heads.map { train(head = it.meters, path = path) }
        val regulator = SignalingRegulator(infra, trains)

        val result = runTrains(regulator.scheduledTrains(), timeStep.seconds, regulator)
        val stalled = assertIs<TimetableResult.Stalled>(result)

        assertEquals(listOf(1, 2, 3, 4), stalled.blocked)
        assertTrue(trains[0].simulator.isFinished)
        assertEquals(
            listOf("SA6_5", "SA6_4", "SA6_3", "SA6_2").map { signalPosition(it, path) },
            trains.drop(1).map { it.simulator.state.position },
        )
    }
}
