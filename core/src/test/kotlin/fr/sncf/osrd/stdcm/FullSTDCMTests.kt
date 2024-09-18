package fr.sncf.osrd.stdcm

import com.google.common.collect.HashMultimap
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.api.api_v2.UndirectedTrackRange
import fr.sncf.osrd.api.api_v2.WorkSchedule
import fr.sncf.osrd.api.api_v2.convertWorkScheduleCollection
import fr.sncf.osrd.api.stdcm.makeTrainSchedule
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.graph.PathfindingEdgeLocationId
import fr.sncf.osrd.railjson.parser.RJSRollingStockParser
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.standalone_sim.result.ResultTrain.SpacingRequirement
import fr.sncf.osrd.standalone_sim.run
import fr.sncf.osrd.stdcm.preprocessing.implementation.makeBlockAvailability
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.Helpers.smallInfra
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.seconds
import java.io.IOException
import java.net.URISyntaxException
import java.util.stream.Stream
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class FullSTDCMTests {
    /**
     * Simple test on tiny infra with no occupancy. This is the same test as the one testing the
     * STDCM API, but calling the methods directly
     */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testTinyInfra() {
        val infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"))
        STDCMPathfindingBuilder()
            .setInfra(infra)
            .setRollingStock(
                RJSRollingStockParser.parse(
                    Helpers.getExampleRollingStock("fast_rolling_stock.json")
                )
            )
            .setStartLocations(
                setOf(
                    Helpers.convertRouteLocation(
                        infra,
                        "rt.buffer_stop_b->tde.foo_b-switch_foo",
                        Offset(100.meters)
                    )
                )
            )
            .setEndLocations(
                setOf(
                    Helpers.convertRouteLocation(
                        infra,
                        "rt.tde.foo_b-switch_foo->buffer_stop_c",
                        Offset(10125.meters)
                    )
                )
            )
            .run()!!
    }

    /**
     * We try to fit a train in a short opening between two trains. We create a train at t=0, get
     * the minimum delay we need (how long its longest occupancy block lasts), add a train at `2 *
     * min delay`, and try to fit a train between the two.
     */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testTinyInfraSmallOpening() {
        val infra = Helpers.fullInfraFromRJS(Helpers.getExampleInfra("tiny_infra/infra.json"))
        val start =
            setOf(
                Helpers.convertRouteLocation(
                    infra,
                    "rt.buffer_stop_b->tde.foo_b-switch_foo",
                    Offset(100.meters)
                )
            )
        val end =
            setOf(
                Helpers.convertRouteLocation(
                    infra,
                    "rt.tde.foo_b-switch_foo->buffer_stop_c",
                    Offset(10125.meters)
                )
            )
        val requirements = makeRequirementsFromPath(infra, start, end, 0.0).toMutableList()
        val minDelay =
            getMaxOccupancyDuration(requirements) // Eventually we may need to add a % margin
        requirements.addAll(makeRequirementsFromPath(infra, start, end, minDelay * 2))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(minDelay)
                .setStartLocations(start)
                .setEndLocations(end)
                .setBlockAvailability(makeBlockAvailability(requirements))
                .setMaxDepartureDelay(minDelay * 2)
                .run()!!
        checkNoConflict(infra, requirements, res)
    }

    /** We try to fit a train in a short opening between two trains, this time on small_infra */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testSmallInfraSmallOpening() {
        val start =
            setOf(
                Helpers.convertRouteLocation(
                    smallInfra,
                    "rt.buffer_stop.3->DB0",
                    Offset(1590.meters)
                )
            )
        val end =
            setOf(
                Helpers.convertRouteLocation(
                    smallInfra,
                    "rt.DH2->buffer_stop.7",
                    Offset(5000.meters)
                )
            )
        val requirements = makeRequirementsFromPath(smallInfra, start, end, 0.0).toMutableList()
        requirements.addAll(makeRequirementsFromPath(smallInfra, start, end, 600.0))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(smallInfra)
                .setStartTime(300.0)
                .setStartLocations(start)
                .setEndLocations(end)
                .setBlockAvailability(makeBlockAvailability(requirements))
                .setMaxDepartureDelay(600.0)
                .run()!!
        checkNoConflict(smallInfra, requirements, res)
    }

    /**
     * We make an opening that is just too small to fit a train, we check that it isn't taken and
     * doesn't cause conflicts
     */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testSmallInfraImpossibleOpening() {
        val start =
            setOf(
                Helpers.convertRouteLocation(
                    smallInfra,
                    "rt.buffer_stop.3->DB0",
                    Offset(1590.meters)
                )
            )
        val end =
            setOf(
                Helpers.convertRouteLocation(
                    smallInfra,
                    "rt.DH2->buffer_stop.7",
                    Offset(5000.meters)
                )
            )
        val requirements = makeRequirementsFromPath(smallInfra, start, end, 0.0).toMutableList()
        val minDelay = getMaxOccupancyDuration(requirements)
        requirements.addAll(makeRequirementsFromPath(smallInfra, start, end, minDelay * 0.95))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(smallInfra)
                .setStartLocations(start)
                .setEndLocations(end)
                .setBlockAvailability(makeBlockAvailability(requirements))
                .run()!!
        checkNoConflict(smallInfra, requirements, res)
    }

    /** Test that we properly account for work schedules */
    @Test
    fun testWorkSchedules() {
        /*
        We look for a path starting on the track TB0, which has a work schedule from t=0 to t=3600
         */
        val blockAvailability =
            makeBlockAvailability(
                convertWorkScheduleCollection(
                        smallInfra.rawInfra,
                        listOf(
                            WorkSchedule(
                                listOf(
                                    UndirectedTrackRange(
                                        "TB0",
                                        Offset(0.meters),
                                        Offset(2000.meters)
                                    )
                                ),
                                0.seconds,
                                3600.seconds
                            )
                        )
                    )
                    .spacingRequirements
            )
        val start =
            setOf(
                Helpers.convertRouteLocation(smallInfra, "rt.buffer_stop.3->DB0", Offset(0.meters))
            )
        val end =
            setOf(
                Helpers.convertRouteLocation(smallInfra, "rt.DH2->buffer_stop.7", Offset(0.meters))
            )
        val res =
            STDCMPathfindingBuilder()
                .setInfra(smallInfra)
                .setStartLocations(start)
                .setEndLocations(end)
                .setBlockAvailability(blockAvailability)
                .run()!!
        assertTrue(res.departureTime >= 3600)
    }

    /** Test that we properly account for start or end scheduled step. */
    @ParameterizedTest
    @MethodSource("plannedTimingDataArg")
    fun testScheduledStartOrEnd(
        start: Set<PathfindingEdgeLocationId<Block>>,
        end: Set<PathfindingEdgeLocationId<Block>>,
        startPlannedTimingData: PlannedTimingData?,
        endPlannedTimingData: PlannedTimingData?,
        expectedPassageTime: Double,
        hasStandardAllowance: Boolean,
    ) {
        val blockAvailability =
            makeBlockAvailability(
                listOf(),
                listOf(
                    STDCMStep(start, 0.0, true, startPlannedTimingData),
                    STDCMStep(end, 0.0, true, endPlannedTimingData)
                )
            )
        val timeStep = 2.0
        var builder =
            STDCMPathfindingBuilder()
                .setInfra(smallInfra)
                .setStartLocations(start, startPlannedTimingData)
                .setEndLocations(end, endPlannedTimingData)
                .setBlockAvailability(blockAvailability)
                .setTimeStep(timeStep)
                .setMaxDepartureDelay(12_000.0)
        if (hasStandardAllowance)
            builder = builder.setStandardAllowance(AllowanceValue.Percentage(5.0))
        val res = builder.run()!!
        if (startPlannedTimingData != null) {
            assertEquals(expectedPassageTime, res.departureTime)
        } else {
            assertEquals(expectedPassageTime, res.departureTime + res.envelope.totalTime, timeStep)
        }
    }

    /** Check that the result we find doesn't cause a conflict */
    private fun checkNoConflict(
        infra: FullInfra,
        requirements: List<SpacingRequirement>,
        res: STDCMResult
    ) {
        val requirementMap = HashMultimap.create<String, SpacingRequirement>()
        for (requirement in requirements) {
            requirementMap.put(requirement.zone, requirement)
        }
        val newRequirements =
            run(
                    res.envelope,
                    res.trainPath,
                    res.chunkPath,
                    makeTrainSchedule(
                        res.envelope.endPos,
                        TestTrains.REALISTIC_FAST_TRAIN,
                        Comfort.STANDARD,
                        res.stopResults
                    ),
                    infra
                )
                .spacingRequirements
        for (requirement in newRequirements) {
            val shifted = requirement.withAddedTime(res.departureTime)
            for (existingRequirement in requirementMap[requirement.zone]) {
                assertTrue(
                    shifted.beginTime >= existingRequirement.endTime ||
                        shifted.endTime <= existingRequirement.beginTime
                )
            }
        }
    }

    private fun plannedTimingDataArg(): Stream<Arguments> {
        val start =
            setOf(
                Helpers.convertRouteLocation(smallInfra, "rt.buffer_stop.3->DB0", Offset(0.meters))
            )
        val end =
            setOf(
                Helpers.convertRouteLocation(smallInfra, "rt.DH2->buffer_stop.7", Offset(0.meters))
            )
        return Stream.of(
            Arguments.of(
                start,
                end,
                PlannedTimingData(300.seconds, 100.seconds, 100.seconds),
                null,
                300.0,
                false,
            ),
            Arguments.of(
                start,
                end,
                PlannedTimingData(300.seconds, 0.seconds, 0.seconds),
                null,
                300.0,
                false,
            ),
            Arguments.of(
                start,
                end,
                null,
                PlannedTimingData(800.seconds, 100.seconds, 100.seconds),
                800.0,
                false,
            ),
            Arguments.of(
                start,
                end,
                null,
                PlannedTimingData(800.seconds, 0.seconds, 0.seconds),
                800.0,
                false,
            ),
            Arguments.of(
                start,
                end,
                null,
                PlannedTimingData(10_000.seconds, 300.seconds, 300.seconds),
                10_000.0,
                false,
            ),
            Arguments.of(
                start,
                end,
                PlannedTimingData(300.seconds, 100.seconds, 100.seconds),
                null,
                300.0,
                true,
            ),
            Arguments.of(
                start,
                end,
                PlannedTimingData(300.seconds, 0.seconds, 0.seconds),
                null,
                300.0,
                true,
            ),
            Arguments.of(
                start,
                end,
                null,
                PlannedTimingData(800.seconds, 100.seconds, 100.seconds),
                800.0,
                true,
            ),
            Arguments.of(
                start,
                end,
                null,
                PlannedTimingData(800.seconds, 0.seconds, 0.seconds),
                800.0,
                true,
            ),
            Arguments.of(
                start,
                end,
                null,
                PlannedTimingData(10_000.seconds, 300.seconds, 300.seconds),
                10_000.0,
                true,
            ),
        )
    }
}
