package fr.sncf.osrd.trainsim

import fr.sncf.osrd.envelope_sim.SimpleContextBuilder.makeSimpleContext
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlocks
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import org.junit.jupiter.api.Test

/**
 * Scenarios to run and look at. Run with:
 * MULTITRAIN_RECORD_DIR=$(pwd) ./gradlew :test --tests 'fr.sncf.osrd.trainsim.SignalingScenarios' --rerun
 * To run a single scnenario:
 * MULTITRAIN_RECORD_DIR=$(pwd) ./gradlew :test --tests 'fr.sncf.osrd.trainsim.SignalingScenarios.signalingRulesShowcase' --rerun
 *
 * Open the jsonl file with core/scripts/trainsim-viewer.html
 */
class SignalingScenarios {
    private val infra = Helpers.smallInfra
    private val timeStep = 2.0

    private fun path(vararg routes: String) =
        buildTrainPathFromBlocks(
            infra.rawInfra,
            infra.blockInfra,
            Helpers.getBlocksOnRoutes(infra, routes.toList()),
            listOf(),
            routes.map { infra.rawInfra.getRouteFromName(it) },
        )

    private val straightPath =
        path("rt.buffer_stop.1->DA0", "rt.DA0->DA5")
            .subPath(Offset(Distance.fromMeters(2000.0)), null)

    private fun train(
        speedLimit: PreciseSpeed,
        departure: PreciseDuration = 0.microseconds,
        path: TrainPath = straightPath,
        head: PreciseDistance = 0.micrometers,
        length: PreciseDistance = 100.0.meters,
        stops: List<Stop> = listOf(),
    ): SignaledTrain {
        val pathLength = path.getLength().distance.meters
        val constraints =
            listOf(SpeedLimitedZone(0.micrometers, pathLength.meters, speedLimit)) + stops
        return SignaledTrain(
            simulator =
                TrainSimulator(
                    makeSimpleContext(pathLength, 0.0, timeStep),
                    constraints,
                    TrainState.zero.copy(position = head),
                ),
            departure = departure,
            path = path,
            length = length,
            baseConstraints = constraints,
        )
    }

    private fun run(trains: List<SignaledTrain>) {
        val regulator = SignalingRegulator(infra, trains)
        val start = System.nanoTime()
        val result = runTrains(regulator.scheduledTrains(), timeStep.seconds, regulator)
        val time = (System.nanoTime() - start) / 1_000_000.0
        println("runTrains took $time ms: ${result::class.simpleName}")
    }

    @Test
    fun signalingRulesShowcase() {
        run(
            listOf(
                train(60.0.kph, stops = listOf(Stop(5500.0.meters, 300.0.seconds))),
                train(120.0.kph, departure = 200.0.seconds),
                train(120.0.kph, departure = 260.0.seconds),
            ),
        )
    }
}
