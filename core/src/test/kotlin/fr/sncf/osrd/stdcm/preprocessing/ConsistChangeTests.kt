package fr.sncf.osrd.stdcm.preprocessing

import fr.sncf.osrd.api.ConsistSchedule
import fr.sncf.osrd.api.PathItem
import fr.sncf.osrd.api.TrackLocation
import fr.sncf.osrd.api.stdcm.ConsistConfiguration
import fr.sncf.osrd.api.stdcm.RequestConsistSchedule
import fr.sncf.osrd.api.stdcm.STDCMEndpoint
import fr.sncf.osrd.api.stdcm.STDCMPathItem
import fr.sncf.osrd.api.stdcm.parseSteps
import fr.sncf.osrd.conflicts.SpacingRequirement
import fr.sncf.osrd.envelope_sim.Comfort
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.stdcm.STDCMCompleteResult
import fr.sncf.osrd.stdcm.STDCMPathfindingBuilder
import fr.sncf.osrd.stdcm.convertRouteLocation
import fr.sncf.osrd.stdcm.infra_exploration.ExplorerStep
import fr.sncf.osrd.stdcm.preprocessing.implementation.makeBlockAvailability
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.time.ZonedDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.assertNull

class ConsistChangeTests {
    @Test
    fun explorationWithConsistChangeProducesExpectedOutput() {
        val infra = Helpers.fullInfraFromFile("small_infra/infra.json")
        val start = convertRouteLocation(infra, "rt.buffer_stop.1->DA0", Offset(100.meters))
        val middle1 = convertRouteLocation(infra, "rt.DC4->DD2", Offset(400.meters))
        val middle2 = convertRouteLocation(infra, "rt.DD2->DD6", Offset(200.meters))
        val end = convertRouteLocation(infra, "rt.DG4->buffer_stop.6", Offset(2000.meters))
        val requirements = emptyList<SpacingRequirement>()
        val slowTrain =
            TestTrains.REALISTIC_FAST_TRAIN.copy(
                maxSpeed = TestTrains.REALISTIC_FAST_TRAIN.maxSpeed / 60
            )
        val mediumTrain =
            TestTrains.REALISTIC_FAST_TRAIN.copy(
                maxSpeed = TestTrains.REALISTIC_FAST_TRAIN.maxSpeed / 10
            )
        val fastTrain =
            TestTrains.REALISTIC_FAST_TRAIN.copy(
                maxSpeed = TestTrains.REALISTIC_FAST_TRAIN.maxSpeed / 2
            )
        val stdcmResult =
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(start.blockLocations)
                .addStep(ExplorerStep(middle1.blockLocations, duration = 2000.0, stop = true))
                .addStep(ExplorerStep(middle2.blockLocations, duration = 2000.0, stop = true))
                .setEndLocations(end.blockLocations)
                .setBlockAvailability(makeBlockAvailability(requirements))
                .setStandardAllowance(AllowanceValue.Percentage(0.0))
                .setRollingStocks(listOf(slowTrain, mediumTrain, fastTrain))
                .setBoundaries(listOf(1, 2))
                .run()!!
        Assertions.assertTrue(stdcmResult is STDCMCompleteResult)
        val stdcmResultSuccess = stdcmResult as STDCMCompleteResult
        val realStops = stdcmResultSuccess.stopResults.filter { it.duration > 0 }.toList()
        assertEquals(2, realStops.size)
        assertEquals(
            slowTrain.maxSpeed,
            stdcmResultSuccess.envelope.maxSpeedInRange(0.0, realStops[0].position),
            0.01,
        )
        assertEquals(
            mediumTrain.maxSpeed,
            stdcmResultSuccess.envelope.maxSpeedInRange(
                realStops[0].position,
                realStops[1].position,
            ),
            0.01,
        )
        assertEquals(
            fastTrain.maxSpeed,
            stdcmResult.envelope.maxSpeedInRange(
                realStops[1].position,
                stdcmResult.envelope.endPos,
            ),
            0.01,
        )
    }

    @Test
    @Disabled("for development purposes")
    fun displayGraphicalResult() {
        val infra = Helpers.fullInfraFromFile("small_infra/infra.json")
        val start = convertRouteLocation(infra, "rt.buffer_stop.1->DA0", Offset(100.meters))
        val middle1 = convertRouteLocation(infra, "rt.DC4->DD2", Offset(400.meters))
        val middle2 = convertRouteLocation(infra, "rt.DD2->DD6", Offset(200.meters))
        val end = convertRouteLocation(infra, "rt.DG4->buffer_stop.6", Offset(2000.meters))
        val requirements = emptyList<SpacingRequirement>()
        val slowTrain =
            TestTrains.REALISTIC_FAST_TRAIN.copy(
                maxSpeed = TestTrains.REALISTIC_FAST_TRAIN.maxSpeed / 60
            )
        val mediumTrain =
            TestTrains.REALISTIC_FAST_TRAIN.copy(
                maxSpeed = TestTrains.REALISTIC_FAST_TRAIN.maxSpeed / 10
            )
        val fastTrain =
            TestTrains.REALISTIC_FAST_TRAIN.copy(
                maxSpeed = TestTrains.REALISTIC_FAST_TRAIN.maxSpeed / 2
            )
        val stdcmResult =
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(start.blockLocations)
                .addStep(ExplorerStep(middle1.blockLocations, duration = 2000.0, stop = true))
                .addStep(ExplorerStep(middle2.blockLocations, duration = 2000.0, stop = true))
                .setEndLocations(end.blockLocations)
                .setBlockAvailability(makeBlockAvailability(requirements))
                .setStandardAllowance(AllowanceValue.Percentage(0.0))
                .setRollingStocks(listOf(slowTrain, mediumTrain, fastTrain))
                .setBoundaries(listOf(1, 2))
                .run()!!
        Assertions.assertTrue(stdcmResult is STDCMCompleteResult)
        val stdcmResultSuccess = stdcmResult as STDCMCompleteResult
        val simulationResponse =
            STDCMEndpoint.buildSimResponse(infra, stdcmResultSuccess, null, null, Comfort.STANDARD)
        STDCMEndpoint.logDebugData(
            infra.rawInfra,
            stdcmResultSuccess,
            simulationResponse,
            ZonedDateTime.now(),
            mapOf(),
        )
    }

    @Test
    /**
     * Given:
     * - A train schedule with 3 steps A -> B -> C.
     * - A consist change on the second step from the consist T1 to the consist T2.
     * - Step C located on a track section incompatible with T1 mods and compatible with T2 mods.
     *
     * We expect:
     * - The first exploration to fail.
     * - The same exploration but with the consist change reversed (T2 swapped at step B for T1) to
     *   succeed.
     */
    fun correctConsistPathfindingConstraintsApplied() {
        val infra = Helpers.fullInfraFromFile("small_infra/infra.json")
        val start = convertRouteLocation(infra, "rt.DD0->DC0", Offset(100.meters))
        val middle = convertRouteLocation(infra, "rt.DC0->DA3", Offset(100.meters))
        val end = convertRouteLocation(infra, "rt.DA3->buffer_stop.0", Offset(2000.meters))
        val requirements = emptyList<SpacingRequirement>()
        assertNull(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(start.blockLocations)
                .addStep(ExplorerStep(middle.blockLocations, duration = 20.0, stop = true))
                .setEndLocations(end.blockLocations)
                .setBlockAvailability(makeBlockAvailability(requirements))
                .setStandardAllowance(AllowanceValue.Percentage(0.0))
                .setRollingStocks(
                    listOf(TestTrains.REALISTIC_FAST_TRAIN, TestTrains.FAST_ELECTRIC_TRAIN)
                )
                .setBoundaries(listOf(1))
                .run()
        )
        assertNotNull(
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(start.blockLocations)
                .addStep(ExplorerStep(middle.blockLocations, duration = 20.0, stop = true))
                .setEndLocations(end.blockLocations)
                .setBlockAvailability(makeBlockAvailability(requirements))
                .setStandardAllowance(AllowanceValue.Percentage(0.0))
                .setRollingStocks(
                    listOf(TestTrains.FAST_ELECTRIC_TRAIN, TestTrains.REALISTIC_FAST_TRAIN)
                )
                .setBoundaries(listOf(1))
                .run()
        )
    }

    @Test
    fun consistChangeOnFirstStepShouldFail() {
        val infra = Helpers.fullInfraFromFile("small_infra/infra.json")
        val start = convertRouteLocation(infra, "rt.buffer_stop.1->DA0", Offset(100.meters))
        val middle = convertRouteLocation(infra, "rt.DD2->DD6", Offset(200.meters))
        val end = convertRouteLocation(infra, "rt.DG4->buffer_stop.6", Offset(2000.meters))
        val requirements = emptyList<SpacingRequirement>()
        val exception =
            Assertions.assertThrows(OSRDError::class.java) {
                STDCMPathfindingBuilder()
                    .setInfra(infra)
                    .setStartLocations(start.blockLocations)
                    .addStep(ExplorerStep(middle.blockLocations, duration = 2000.0, stop = true))
                    .setEndLocations(end.blockLocations)
                    .setBlockAvailability(makeBlockAvailability(requirements))
                    .setStandardAllowance(AllowanceValue.Percentage(0.0))
                    .setRollingStocks(
                        listOf(TestTrains.REALISTIC_FAST_TRAIN, TestTrains.FAST_ELECTRIC_TRAIN)
                    )
                    .setBoundaries(listOf(0))
                    .run()
            }
        assertEquals(
            "Consist change specified on the first or last step of the path",
            exception.context["cause"],
        )
    }

    @Test
    fun consistChangeOnLastStepShouldFail() {
        val infra = Helpers.fullInfraFromFile("small_infra/infra.json")
        val start = convertRouteLocation(infra, "rt.buffer_stop.1->DA0", Offset(100.meters))
        val middle = convertRouteLocation(infra, "rt.DD2->DD6", Offset(200.meters))
        val end = convertRouteLocation(infra, "rt.DG4->buffer_stop.6", Offset(2000.meters))
        val requirements = emptyList<SpacingRequirement>()
        val exception =
            Assertions.assertThrows(OSRDError::class.java) {
                STDCMPathfindingBuilder()
                    .setInfra(infra)
                    .setStartLocations(start.blockLocations)
                    .addStep(ExplorerStep(middle.blockLocations, duration = 2000.0, stop = true))
                    .setEndLocations(end.blockLocations)
                    .setBlockAvailability(makeBlockAvailability(requirements))
                    .setStandardAllowance(AllowanceValue.Percentage(0.0))
                    .setRollingStocks(
                        listOf(TestTrains.REALISTIC_FAST_TRAIN, TestTrains.FAST_ELECTRIC_TRAIN)
                    )
                    .setBoundaries(listOf(2))
                    .run()
            }
        assertEquals(
            "Consist change specified on the first or last step of the path",
            exception.context["cause"],
        )
    }

    @Test
    fun stopsWithoutConsistChanges() {
        // Mixing up stop steps with and without consist changes
        val infra = Helpers.fullInfraFromFile("small_infra/infra.json")
        val start = convertRouteLocation(infra, "rt.buffer_stop.1->DA0", Offset(100.meters))
        val step1 = convertRouteLocation(infra, "rt.DC4->DD2", Offset(400.meters))
        val step2 = convertRouteLocation(infra, "rt.DD2->DD6", Offset(200.meters))
        val end = convertRouteLocation(infra, "rt.DG4->buffer_stop.6", Offset(2000.meters))
        val requirements = emptyList<SpacingRequirement>()
        val slowTrain =
            TestTrains.REALISTIC_FAST_TRAIN.copy(
                maxSpeed = TestTrains.REALISTIC_FAST_TRAIN.maxSpeed / 60
            )
        val fastTrain =
            TestTrains.REALISTIC_FAST_TRAIN.copy(
                maxSpeed = TestTrains.REALISTIC_FAST_TRAIN.maxSpeed / 10
            )
        val stdcmResult =
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartLocations(start.blockLocations)
                .addStep(ExplorerStep(step1.blockLocations, duration = 2000.0, stop = true))
                .addStep(ExplorerStep(step2.blockLocations, duration = 2000.0, stop = true))
                .setEndLocations(end.blockLocations)
                .setBlockAvailability(makeBlockAvailability(requirements))
                .setStandardAllowance(AllowanceValue.Percentage(0.0))
                .setRollingStocks(listOf(slowTrain, fastTrain))
                .setBoundaries(listOf(2))
                .run()!!
        Assertions.assertTrue(stdcmResult is STDCMCompleteResult)
        val stdcmResultSuccess = stdcmResult as STDCMCompleteResult
        val realStops = stdcmResultSuccess.stopResults.filter { it.duration > 0 }.toList()
        assertEquals(2, realStops.size)
        // The first train should be used up to the second stop
        assertEquals(
            slowTrain.maxSpeed,
            stdcmResultSuccess.envelope.maxSpeedInRange(0.0, realStops[0].position),
            0.01,
        )
        assertEquals(
            slowTrain.maxSpeed,
            stdcmResultSuccess.envelope.maxSpeedInRange(
                realStops[0].position,
                realStops[1].position,
            ),
            0.01,
        )
        assertEquals(
            fastTrain.maxSpeed,
            stdcmResultSuccess.envelope.maxSpeedInRange(
                realStops[1].position,
                stdcmResultSuccess.envelope.endPos,
            ),
            0.01,
        )
    }

    @Test
    /**
     * Parsing the list of consist changes and their boundaries of an STDCM request should create a
     * ConsistSchedule which contains the lists of the rolling stocks per step and their associated
     * pathfinding constraints.
     */
    fun parseRequestConsistChanges() {
        val nbSteps = 8
        val consist1 =
            ConsistConfiguration(
                listOf(),
                null,
                RJSLoadingGaugeType.GB,
                Helpers.getExampleRollingStock("short_slow_rolling_stock.json")
                    .copy(length = Length(100.meters)),
            )
        val consist2 =
            ConsistConfiguration(
                listOf(),
                null,
                RJSLoadingGaugeType.GB,
                Helpers.getExampleRollingStock("fast_rolling_stock.json")
                    .copy(length = Length(200.meters)),
            )
        val consist3 =
            ConsistConfiguration(
                listOf(),
                null,
                RJSLoadingGaugeType.GB,
                Helpers.getExampleRollingStock("fast_rolling_stock.json")
                    .copy(length = Length(300.meters)),
            )
        val requestConsistSchedule =
            RequestConsistSchedule(listOf(1, 3, 6), listOf(consist1, consist2, consist1, consist3))
        val infra = Helpers.fullInfraFromFile("small_infra/infra.json")
        val consistSchedule = ConsistSchedule(requestConsistSchedule, infra, emptySet(), nbSteps)
        val expected = listOf(100.0, 200.0, 200.0, 100.0, 100.0, 100.0, 300.0, 300.0)
        assertEquals(expected, consistSchedule.rollingStocks.map { it.length })
    }

    @Test
    /**
     * When an STDCM request contains a consist change, the StepExplorers locations should be built
     * using the longest rolling stock related to that consist change (the longest consist between
     * the previous step and the current step).
     */
    fun parseStepsMultipleConsists() {
        // Note: this test only checks that the longest consist change is used when creating the
        // steps. It doesn't check if the block locations we find for those waypoints make sense
        // with the given lengths.
        val nbSteps = 4
        val shorterConsist =
            ConsistConfiguration(
                listOf(),
                null,
                RJSLoadingGaugeType.GB,
                Helpers.getExampleRollingStock("short_slow_rolling_stock.json")
                    .copy(length = Length(50.meters)),
            )
        val longerConsist =
            ConsistConfiguration(
                listOf(),
                null,
                RJSLoadingGaugeType.GB,
                Helpers.getExampleRollingStock("fast_rolling_stock.json")
                    .copy(length = Length(200.meters)),
            )
        val requestShortLongShort =
            RequestConsistSchedule(
                listOf(1, 2),
                listOf(shorterConsist, longerConsist, shorterConsist),
            )
        val infra = Helpers.fullInfraFromFile("small_infra/infra.json")
        val consistShortLongShort =
            ConsistSchedule(requestShortLongShort, infra, emptySet(), nbSteps)
        val pathItems =
            listOf(
                STDCMPathItem(
                    PathItem(listOf(TrackLocation("TB0", Offset(0.0.meters))), false),
                    null,
                    null,
                ),
                STDCMPathItem(
                    PathItem(listOf(TrackLocation("TB0", Offset(500.0.meters))), false),
                    Duration(100_000),
                    null,
                ),
                STDCMPathItem(
                    PathItem(listOf(TrackLocation("TB0", Offset(1000.0.meters))), false),
                    Duration(100_000),
                    null,
                ),
                STDCMPathItem(
                    PathItem(listOf(TrackLocation("TB0", Offset(1500.meters))), false),
                    Duration(100_000),
                    null,
                ),
            )
        val stepsShortLongShort =
            parseSteps(
                infra,
                pathItems,
                ZonedDateTime.now(),
                consistShortLongShort.rollingStocks.map { it.length },
            )
        val requestSingleShortTrain = RequestConsistSchedule(emptyList(), listOf(shorterConsist))
        val consistSingleShortTrain =
            ConsistSchedule(requestSingleShortTrain, infra, emptySet(), nbSteps)
        val stepsSingleShortTrain =
            parseSteps(
                infra,
                pathItems,
                ZonedDateTime.now(),
                consistSingleShortTrain.rollingStocks.map { it.length },
            )
        assert(stepsShortLongShort.size == 4) // Sanity check
        assert(stepsSingleShortTrain.size == 4) // Sanity check
        // Checking that the longer train is used to determine the block location:
        stepsShortLongShort.slice(1..2).zip(stepsSingleShortTrain.slice(1..2)).forEach { pair ->
            val stepWithLongerTrain = pair.first
            val stepWithShortTrain = pair.second
            val trainLengthDiff =
                longerConsist.physicsConsist.length - shorterConsist.physicsConsist.length
            assert(trainLengthDiff > 0.meters) // Sanity check
            stepWithLongerTrain.locations.zip(stepWithShortTrain.locations).forEach {
                val stopOffsetLongerTrain = it.first.offset
                val stopOffsetShortTrain = it.second.offset
                assertEquals(it.first.edge, it.second.edge) // Sanity check
                // The longest consist between the previous and current step should be used
                assertEquals(stopOffsetLongerTrain, stopOffsetShortTrain + trainLengthDiff)
            }
        }
    }
}
