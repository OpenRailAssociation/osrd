package fr.sncf.osrd.stdcm

import fr.sncf.osrd.api.*
import fr.sncf.osrd.api.pathfinding.PathfindingBlockRequest
import fr.sncf.osrd.api.pathfinding.PathfindingBlockSuccess
import fr.sncf.osrd.api.pathfinding.runPathfinding
import fr.sncf.osrd.conflicts.SpacingRequirement
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.railjson.schema.schedule.RJSAllowanceDistribution
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.standalone_sim.runStandaloneSimulation
import fr.sncf.osrd.stdcm.preprocessing.implementation.makeBlockAvailability
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains.REALISTIC_FAST_TRAIN
import fr.sncf.osrd.utils.*
import fr.sncf.osrd.utils.Helpers.LocationPair
import fr.sncf.osrd.utils.Helpers.convertRouteLocationToBlockLocation
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
                parseRawRollingStock(
                    Helpers.getExampleRollingStock("fast_rolling_stock.json"),
                    rollingStockSupportedSignalingSystems = listOf("BAL"),
                )
            )
            .setStartLocations(
                setOf(
                    convertRouteLocationToBlockLocation(
                        infra,
                        "rt.buffer_stop_b->tde.foo_b-switch_foo",
                        Offset(100.meters),
                    )
                )
            )
            .setEndLocations(
                setOf(
                    convertRouteLocationToBlockLocation(
                        infra,
                        "rt.tde.foo_b-switch_foo->buffer_stop_c",
                        Offset(10125.meters),
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
            convertRouteLocation(
                infra,
                "rt.buffer_stop_b->tde.foo_b-switch_foo",
                Offset(100.meters),
            )
        val end =
            convertRouteLocation(
                infra,
                "rt.tde.foo_b-switch_foo->buffer_stop_c",
                Offset(10125.meters),
            )
        val requirements =
            makeRequirementsFromPath(infra, start.trackLocations, end.trackLocations, 0.0)
                .toMutableList()
        val minDelay =
            getMaxOccupancyDuration(requirements) // Eventually we may need to add a % margin
        requirements.addAll(
            makeRequirementsFromPath(infra, start.trackLocations, end.trackLocations, minDelay * 2)
        )
        STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(minDelay)
            .setStartLocations(start.blockLocations)
            .setEndLocations(end.blockLocations)
            .setBlockAvailability(makeBlockAvailability(requirements))
            .setMaxDepartureDelay(minDelay * 2)
            .run()!!
    }

    /** We try to fit a train in a short opening between two trains, this time on small_infra */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testSmallInfraSmallOpening() {
        val start = convertRouteLocation(smallInfra, "rt.buffer_stop.3->DB0", Offset(1590.meters))
        val end = convertRouteLocation(smallInfra, "rt.DH2->buffer_stop.7", Offset(5000.meters))
        val requirements =
            makeRequirementsFromPath(smallInfra, start.trackLocations, end.trackLocations, 0.0)
                .toMutableList()
        requirements.addAll(
            makeRequirementsFromPath(smallInfra, start.trackLocations, end.trackLocations, 600.0)
        )
        STDCMPathfindingBuilder()
            .setInfra(smallInfra)
            .setStartTime(300.0)
            .setStartLocations(start.blockLocations)
            .setEndLocations(end.blockLocations)
            .setBlockAvailability(makeBlockAvailability(requirements))
            .setMaxDepartureDelay(600.0)
            .run()!!
    }

    /**
     * We make an opening that is just too small to fit a train, we check that it isn't taken and
     * doesn't cause conflicts
     */
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun testSmallInfraImpossibleOpening() {
        val start = convertRouteLocation(smallInfra, "rt.buffer_stop.3->DB0", Offset(1590.meters))
        val end = convertRouteLocation(smallInfra, "rt.DH2->buffer_stop.7", Offset(5000.meters))
        val requirements =
            makeRequirementsFromPath(smallInfra, start.trackLocations, end.trackLocations, 0.0)
                .toMutableList()
        val minDelay = getMaxOccupancyDuration(requirements)
        requirements.addAll(
            makeRequirementsFromPath(
                smallInfra,
                start.trackLocations,
                end.trackLocations,
                minDelay * 0.95,
            )
        )
        STDCMPathfindingBuilder()
            .setInfra(smallInfra)
            .setStartLocations(start.blockLocations)
            .setEndLocations(end.blockLocations)
            .setBlockAvailability(makeBlockAvailability(requirements))
            .run()!!
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
                                listOf(TrackRange("TB0", Offset(0.meters), Offset(2000.meters))),
                                0.seconds,
                                3600.seconds,
                            )
                        ),
                    )
                    .spacingRequirements
            )
        val start = convertRouteLocation(smallInfra, "rt.buffer_stop.3->DB0", Offset(0.meters))
        val end = convertRouteLocation(smallInfra, "rt.DH2->buffer_stop.7", Offset(0.meters))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(smallInfra)
                .setStartLocations(start.blockLocations)
                .setEndLocations(end.blockLocations)
                .setBlockAvailability(blockAvailability)
                .run()!!
        assertTrue(res.departureTime >= 3600)
    }

    /** Test that we properly account for start or end scheduled step. */
    @ParameterizedTest
    @MethodSource("plannedTimingDataArg")
    fun testScheduledStartOrEnd(
        start: Helpers.LocationPair,
        end: Helpers.LocationPair,
        startPlannedTimingData: PlannedTimingData?,
        endPlannedTimingData: PlannedTimingData?,
        expectedPassageTime: Double,
        hasStandardAllowance: Boolean,
    ) {
        val blockAvailability = makeBlockAvailability(listOf())
        val timeStep = 2.0
        var builder =
            STDCMPathfindingBuilder()
                .setInfra(smallInfra)
                .setStartLocations(start.blockLocations, startPlannedTimingData)
                .setEndLocations(end.blockLocations, endPlannedTimingData)
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
        assertTrue(res.departureTime <= 12_000.0) // Max departure delay
    }

    /**
     * Very long stop with an occupancy that starts after the stop end at the stop location. The
     * requested arrival time may make us stay longer at the stop location, to the point of causing
     * a conflict. Not finding a solution is valid, we're looking for crashes (specifically
     * postprocessing assertions). Reproduces a bug.
     */
    @Test
    fun testConflictAtStop() {
        val infra =
            Helpers.fullInfraFromRJS(Helpers.getExampleInfra("overlapping_routes/infra.json"))
        val start = convertRouteLocation(infra, "rt.det.a1.nf->det.b1.nf", Offset(0.meters))
        val stop =
            convertRouteLocation(
                infra,
                "rt.det.a1.nf->det.b1.nf",
                Offset(6_000.meters), // Within sight distance of a signal
            )
        val end = convertRouteLocation(infra, "rt.det.a1.nf->det.b1.nf", Offset(10_000.meters))
        val zoneNameAtStop = "zone.[det.center.1:INCREASING, det.center.2:DECREASING]"
        val zoneAtStop = infra.rawInfra.getZoneFromName(zoneNameAtStop)
        val requirements =
            listOf(SpacingRequirement(zoneAtStop, 7_000.0, Double.POSITIVE_INFINITY, true))
        STDCMPathfindingBuilder()
            .setInfra(infra)
            .setStartTime(0.0)
            .setStartLocations(start.blockLocations)
            .addStep(STDCMStep(stop.blockLocations, 5_000.0, true))
            .setEndLocations(
                end.blockLocations,
                PlannedTimingData(10_000.seconds, 0.seconds, 0.seconds),
            )
            .setBlockAvailability(makeBlockAvailability(requirements))
            .setMaxRunTime(Double.POSITIVE_INFINITY)
            .setMaxDepartureDelay(0.0)
            .run() ?: return
    }

    /**
     * The zone after the stop isn't available during the stop itself (and for a little while
     * after). There is a solution if we lengthen the stop, but we need to properly account for the
     * 20s margin where the signal must be green before the stop departure.
     */
    @Test
    fun testConflictAfterStop() {
        val infra =
            Helpers.fullInfraFromRJS(Helpers.getExampleInfra("overlapping_routes/infra.json"))
        val start = convertRouteLocation(infra, "rt.det.a1.nf->det.b1.nf", Offset(0.meters))
        val stop =
            convertRouteLocation(
                infra,
                "rt.det.a1.nf->det.b1.nf",
                Offset(6_000.meters), // Within sight distance of a signal
            )
        val end = convertRouteLocation(infra, "rt.det.a1.nf->det.b1.nf", Offset(10_000.meters))
        val zoneNameAfterStop = "zone.[det.center.2:INCREASING, det.center.3:DECREASING]"
        val zoneAfterStop = infra.rawInfra.getZoneFromName(zoneNameAfterStop)
        val requirements = listOf(SpacingRequirement(zoneAfterStop, 0.0, 7_000.0, true))
        val res =
            STDCMPathfindingBuilder()
                .setInfra(infra)
                .setStartTime(0.0)
                .setStartLocations(start.blockLocations)
                .addStep(STDCMStep(stop.blockLocations, 5_000.0, true))
                .setEndLocations(end.blockLocations)
                .setBlockAvailability(makeBlockAvailability(requirements))
                .setMaxRunTime(Double.POSITIVE_INFINITY)
                .setMaxDepartureDelay(0.0)
                .run()!!
        assertTrue(res.stopResults.first().duration > 5_000.0) {
            "if a solution can be found without lengthening the stop, the test itself is broken"
        }
    }

    private fun plannedTimingDataArg(): Stream<Arguments> {
        val start = convertRouteLocation(smallInfra, "rt.buffer_stop.3->DB0", Offset(0.meters))
        val end = convertRouteLocation(smallInfra, "rt.DH2->buffer_stop.7", Offset(0.meters))
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
            Arguments.of(
                start,
                end,
                null,
                PlannedTimingData(20_000.seconds, 1_000.seconds, 1_000.seconds),
                19_000.0, // We'd need more than max departure delay to reach 20_000
                true,
            ),
        )
    }
}

/** Converts a route + offset into a track location. */
private fun convertRouteLocationToTrackLocation(
    infra: RawInfra,
    routeName: String,
    offset: Offset<Route>,
): TrackLocation {
    var mutOffset = offset
    val zones = infra.getRoutePath(infra.getRouteFromName(routeName))
    val chunks = zones.flatMap { infra.getZonePathChunks(it) }
    for (chunk in chunks) {
        val chunkLength = infra.getTrackChunkLength(chunk.value)
        val track = infra.getTrackFromChunk(chunk.value)
        val trackName = infra.getTrackSectionName(track)
        if (mutOffset <= chunkLength.cast()) {
            val chunkOffset = infra.getTrackChunkOffset(chunk.value)
            val resultOffset =
                if (chunk.direction == Direction.INCREASING)
                    chunkOffset.distance + chunkLength.distance - mutOffset.distance
                else chunkOffset.distance + mutOffset.distance
            return TrackLocation(trackName, Offset(resultOffset))
        }
        mutOffset -= chunkLength.distance
    }
    throw RuntimeException("Couldn't find route location")
}

fun convertRouteLocation(infra: FullInfra, routeName: String, offset: Offset<Route>): LocationPair {
    return LocationPair(
        setOf(convertRouteLocationToBlockLocation(infra, routeName, offset)),
        setOf(convertRouteLocationToTrackLocation(infra.rawInfra, routeName, offset)),
    )
}

/** Make the occupancy multimap of a train going from point A to B starting at departureTime */
fun makeRequirementsFromPath(
    infra: FullInfra,
    startLocations: Set<TrackLocation>,
    endLocations: Set<TrackLocation>,
    departureTime: Double,
    rollingStock: RollingStock = REALISTIC_FAST_TRAIN,
): List<SpacingRequirement> {
    val path =
        runPathfinding(
            infra,
            PathfindingBlockRequest(
                rollingStock.loadingGaugeType,
                rollingStock.isThermal,
                rollingStock.modeNames.toList(),
                rollingStock.supportedSignalingSystems.toList(),
                rollingStock.maxSpeed,
                rollingStock.length,
                null,
                null,
                "",
                null,
                listOf(startLocations, endLocations),
            ),
        )
            as PathfindingBlockSuccess

    val trainPath = path.path.toTrainPath(infra.rawInfra, infra.blockInfra, null)
    val sim =
        runStandaloneSimulation(
            infra,
            trainPath,
            rollingStock,
            Comfort.STANDARD,
            RJSAllowanceDistribution.LINEAR,
            null,
            distanceRangeMapOf(),
            useElectricalProfiles = false,
            useSpeedLimits = true,
            2.0,
            listOf(),
            0.0,
            RangeValues(),
            listOf(),
        )

    return sim.finalOutput.spacingRequirements.map {
        SpacingRequirement.fromRJS(it, infra.rawInfra())
    }
}
