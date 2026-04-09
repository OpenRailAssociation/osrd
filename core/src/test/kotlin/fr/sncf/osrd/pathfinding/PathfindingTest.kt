package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.api.InfraMetadata
import fr.sncf.osrd.api.PathItem
import fr.sncf.osrd.api.TrackLocation
import fr.sncf.osrd.api.pathfinding.*
import fr.sncf.osrd.cli.RqFake
import fr.sncf.osrd.path.interfaces.JsonTrainPath.TrackSectionRange
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSLoadingGaugeLimit
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.md5
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.OffsetRange
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.assertj.core.api.AssertionsForClassTypes
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance

fun getPathfindingBlockRequest(
    rs: RollingStock,
    trackLocations: List<PathItem>,
    infra: String = "unused_name",
    stopsAtEndOfBlock: Boolean? = false,
): PathfindingBlockRequest {
    return PathfindingBlockRequest(
        rs.loadingGaugeType,
        rs.isThermal,
        rs.modeNames.filterNot { it == "thermal" },
        rs.supportedSignalingSystems.toList(),
        rs.maxSpeed,
        rs.length,
        null,
        stopsAtEndOfBlock,
        null,
        infra,
        1,
        trackLocations,
    )
}

fun checkPathfindingSuccess(
    pathResp: PathfindingBlockResponse,
    expectedLength: Distance,
    expectedTrackSectionRanges: List<TrackSectionRange>? = null,
    expectedBlocks: List<String>? = null,
    expectedRoutes: List<String>? = null,
    expectedIntermediatePathItemPosition: List<Offset<PhysicsPath>> = listOf(),
): PathfindingBlockSuccess {
    assertThat(pathResp).isExactlyInstanceOf(PathfindingBlockSuccess::class.java)
    val pathSuccess = pathResp as PathfindingBlockSuccess

    AssertionsForClassTypes.assertThat(pathSuccess.length.distance).isEqualTo(expectedLength)
    val expectedPathItemsPos =
        listOf(Offset<PhysicsPath>(0.meters))
            .plus(expectedIntermediatePathItemPosition)
            .plusElement(Offset(pathSuccess.length.distance))
    assertEquals(expectedPathItemsPos, pathSuccess.pathItemPositions)
    assertEquals(pathSuccess.pathItemPositions.sorted(), pathSuccess.pathItemPositions)

    if (expectedBlocks != null) {
        assertEquals(
            expectedBlocks.map { "block.${md5(it)}" },
            pathSuccess.path.blocks.map { it.id },
        )
    }
    if (expectedRoutes != null) {
        assertEquals(expectedRoutes, pathSuccess.path.routes.map { it.id })
    }
    if (expectedTrackSectionRanges != null) {
        assertEquals(expectedTrackSectionRanges, pathSuccess.path.trackSectionRanges)
    }

    return pathSuccess
}

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PathfindingTest : ApiTest() {

    @Test
    fun simpleTinyInfraTest() {
        val waypointsStart = listOf(TrackLocation("ne.micro.foo_b", Offset(50.meters)))
        val waypointsEnd = listOf(TrackLocation("ne.micro.bar_a", Offset(100.meters)))
        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                listOf(PathItem(waypointsStart, true), PathItem(waypointsEnd, true)),
                "tiny_infra/infra.json",
            )
        checkPathfindingSuccess(
            parsed,
            10250.meters,
            expectedBlocks =
                listOf(
                    "[il.sig.C3-BAL];[buffer_stop_b, tde.foo_b-switch_foo];[]",
                    "[il.sig.C3-BAL, il.sig.S7-BAL];[tde.foo_b-switch_foo, tde.track-bar];[il.switch_foo-A_B1]",
                    "[il.sig.S7-BAL];[tde.track-bar, buffer_stop_c];[]",
                ),
            expectedRoutes =
                listOf(
                    "rt.buffer_stop_b->tde.foo_b-switch_foo",
                    "rt.tde.foo_b-switch_foo->buffer_stop_c",
                ),
            expectedTrackSectionRanges =
                listOf(
                    TrackSectionRange(
                        "ne.micro.foo_b",
                        Offset(50.meters),
                        Offset(200.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "ne.micro.foo_to_bar",
                        Offset(0.meters),
                        Offset(10_000.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "ne.micro.bar_a",
                        Offset(0.meters),
                        Offset(100.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                ),
        )
    }

    @Test
    fun incompatibleElectrification() {
        val waypointStart = TrackLocation("ne.micro.foo_b", Offset(50.meters))
        val waypointEnd = TrackLocation("ne.micro.bar_a", Offset(100.meters))
        val waypointsStart = PathItem(listOf(waypointStart), false)
        val waypointsEnd = PathItem(listOf(waypointEnd), false)
        val waypoints = listOf(waypointsStart, waypointsEnd)

        val unconstrainedRequestBody =
            pathfindingRequestAdapter.toJson(
                PathfindingBlockRequest(
                    rollingStockLoadingGauge = RJSLoadingGaugeType.G1,
                    rollingStockIsThermal = true,
                    rollingStockSupportedElectrifications = listOf(),
                    rollingStockSupportedSignalingSystems =
                        listOf("BAL", "BAPR", "TVM300", "TVM430"),
                    rollingStockMaximumSpeed = 320.0,
                    rollingStockLength = 0.0,
                    timeout = null,
                    infra = "tiny_infra/infra.json",
                    expectedVersion = 1,
                    pathItems = waypoints,
                )
            )
        val unconstrainedResponse =
            PathfindingBlocksEndpoint(infraManager).act(RqFake(unconstrainedRequestBody))
        val unconstrainedParsed =
            (pathfindingResponseAdapter.fromJson(unconstrainedResponse.body())
                as? PathfindingBlockSuccess)!!

        val requestBody =
            pathfindingRequestAdapter.toJson(
                PathfindingBlockRequest(
                    rollingStockLoadingGauge = RJSLoadingGaugeType.GC,
                    rollingStockIsThermal = false,
                    rollingStockSupportedElectrifications = listOf("nonexistent_electrification"),
                    rollingStockSupportedSignalingSystems = listOf("BAL"),
                    timeout = null,
                    rollingStockMaximumSpeed = 320.0,
                    rollingStockLength = 0.0,
                    infra = "tiny_infra/infra.json",
                    expectedVersion = 1,
                    pathItems = waypoints,
                )
            )
        val response = PathfindingBlocksEndpoint(infraManager).act(RqFake(requestBody))
        val parsed =
            (pathfindingResponseAdapter.fromJson(response.body())
                as? IncompatibleConstraintsPathResponse)!!
        assert(parsed.relaxedConstraintsPath == unconstrainedParsed)
        assert(
            parsed.incompatibleConstraints ==
                IncompatibleConstraints(
                    incompatibleElectrificationRanges =
                        listOf(
                            RangeValue(
                                OffsetRange(Offset.zero(), Offset(10250.meters)),
                                "", // range not electrified
                            )
                        ),
                    incompatibleGaugeRanges = listOf(),
                    incompatibleSignalingSystemRanges = listOf(),
                )
        )
    }

    @Test
    fun incompatibleConstraints() {
        val waypointStart = TrackLocation("TA0", Offset(0.meters))
        val waypointEnd = TrackLocation("TA6", Offset(2000.meters))
        val waypointsStart = PathItem(listOf(waypointStart), false)
        val waypointsEnd = PathItem(listOf(waypointEnd), false)
        val waypoints = listOf(waypointsStart, waypointsEnd)

        val unconstrainedRequestBody =
            pathfindingRequestAdapter.toJson(
                PathfindingBlockRequest(
                    rollingStockLoadingGauge = RJSLoadingGaugeType.G1,
                    rollingStockIsThermal = true,
                    rollingStockSupportedElectrifications = listOf(),
                    rollingStockSupportedSignalingSystems =
                        listOf("BAL", "BAPR", "TVM300", "TVM430"),
                    timeout = null,
                    rollingStockMaximumSpeed = 320.0,
                    rollingStockLength = 0.0,
                    infra = "small_infra/infra.json",
                    expectedVersion = 1,
                    pathItems = waypoints,
                )
            )
        val unconstrainedResponse =
            PathfindingBlocksEndpoint(infraManager).act(RqFake(unconstrainedRequestBody))
        val unconstrainedParsed =
            (pathfindingResponseAdapter.fromJson(unconstrainedResponse.body())
                as? PathfindingBlockSuccess)!!

        val requestBody =
            pathfindingRequestAdapter.toJson(
                PathfindingBlockRequest(
                    rollingStockLoadingGauge = RJSLoadingGaugeType.GC,
                    rollingStockIsThermal = false,
                    rollingStockSupportedElectrifications = listOf("nonexistent_electrification"),
                    rollingStockSupportedSignalingSystems = listOf("TVM300"),
                    rollingStockMaximumSpeed = 320.0,
                    rollingStockLength = 0.0,
                    timeout = null,
                    infra = "small_infra/infra.json",
                    expectedVersion = 1,
                    pathItems = waypoints,
                )
            )
        val response = PathfindingBlocksEndpoint(infraManager).act(RqFake(requestBody))

        val parsed =
            (pathfindingResponseAdapter.fromJson(response.body())
                as? IncompatibleConstraintsPathResponse)!!
        assert(parsed.relaxedConstraintsPath == unconstrainedParsed)
        assert(
            parsed.incompatibleConstraints ==
                IncompatibleConstraints(
                    incompatibleElectrificationRanges =
                        listOf(
                            RangeValue(OffsetRange(Offset.zero(), Offset(1960.meters)), "1500V"),
                            // neutral section in-between
                            RangeValue(
                                OffsetRange(Offset(2010.meters), Offset(4000.meters)),
                                "25000V",
                            ),
                        ),
                    // multiple different loading gauges on the track
                    incompatibleGaugeRanges =
                        listOf(
                            RangeValue(OffsetRange(Offset.zero(), Offset(100.meters)), null),
                            RangeValue(OffsetRange(Offset(100.meters), Offset(200.meters)), null),
                            RangeValue(OffsetRange(Offset(200.meters), Offset(1500.meters)), null),
                            RangeValue(OffsetRange(Offset(1500.meters), Offset(1900.meters)), null),
                        ),
                    incompatibleSignalingSystemRanges =
                        listOf(RangeValue(OffsetRange(Offset.zero(), Offset(4000.meters)), "BAL")),
                )
        )
    }

    @Test
    fun testMiddleStop() {
        val waypointsStart = listOf(TrackLocation("ne.micro.foo_b", Offset(100.meters)))
        val waypointsMid = listOf(TrackLocation("ne.micro.foo_to_bar", Offset(5000.meters)))
        val waypointsEnd = listOf(TrackLocation("ne.micro.bar_a", Offset(100.meters)))
        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                listOf(
                    PathItem(waypointsStart, false),
                    PathItem(waypointsMid, false),
                    PathItem(waypointsEnd, false),
                ),
                "tiny_infra/infra.json",
            )
        checkPathfindingSuccess(
            parsed,
            10200.meters,
            expectedIntermediatePathItemPosition = listOf(Offset(5100.meters)),
            expectedBlocks =
                listOf(
                    "[il.sig.C3-BAL];[buffer_stop_b, tde.foo_b-switch_foo];[]",
                    "[il.sig.C3-BAL, il.sig.S7-BAL];[tde.foo_b-switch_foo, tde.track-bar];[il.switch_foo-A_B1]",
                    "[il.sig.S7-BAL];[tde.track-bar, buffer_stop_c];[]",
                ),
            expectedRoutes =
                listOf(
                    "rt.buffer_stop_b->tde.foo_b-switch_foo",
                    "rt.tde.foo_b-switch_foo->buffer_stop_c",
                ),
            expectedTrackSectionRanges =
                listOf(
                    TrackSectionRange(
                        "ne.micro.foo_b",
                        Offset(100.meters),
                        Offset(200.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "ne.micro.foo_to_bar",
                        Offset(0.meters),
                        Offset(10_000.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "ne.micro.bar_a",
                        Offset(0.meters),
                        Offset(100.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                ),
        )
    }

    @Test
    fun noPathTest() {
        val waypointsStart = listOf(TrackLocation("ne.micro.foo_b", Offset(100.meters)))
        val waypointsEnd = listOf(TrackLocation("ne.micro.foo_a", Offset(100.meters)))
        val requestBody =
            pathfindingRequestAdapter.toJson(
                getPathfindingBlockRequest(
                    TestTrains.REALISTIC_FAST_TRAIN,
                    listOf(PathItem(waypointsStart, false), PathItem(waypointsEnd, false)),
                    "tiny_infra/infra.json",
                )
            )
        val response = PathfindingBlocksEndpoint(infraManager).act(RqFake(requestBody))
        assert(response.statusCode() == 200)
        val parsed = (pathfindingResponseAdapter.fromJson(response.body()) as? NotFoundInBlocks)!!
        AssertionsForClassTypes.assertThat(parsed).isNotNull
    }

    @Test
    fun missingTrackTest() {
        val waypointsStart = listOf(TrackLocation("this_track_does_not_exist", Offset(0.meters)))
        val requestBody =
            pathfindingRequestAdapter.toJson(
                getPathfindingBlockRequest(
                    TestTrains.REALISTIC_FAST_TRAIN,
                    listOf(PathItem(waypointsStart, false)),
                    "tiny_infra/infra.json",
                )
            )
        val response = PathfindingBlocksEndpoint(infraManager).act(RqFake(requestBody))
        assert(response.statusCode() == 200)
        val parsed = (pathfindingResponseAdapter.fromJson(response.body()) as? PathfindingFailed)!!
        AssertionsForClassTypes.assertThat(parsed.coreError.type)
            .isEqualTo("core:unknown_track_section")
    }

    @Test
    fun incompatibleLoadingGaugeTest() {
        val waypointsStart = listOf(TrackLocation("ne.micro.foo_b", Offset(100.meters)))
        val waypointsEnd = listOf(TrackLocation("ne.micro.bar_a", Offset(100.meters)))

        val rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json")
        for (track in rjsInfra.trackSections) if (track.getID() == "ne.micro.foo_to_bar")
            track.loadingGaugeLimits =
                listOf(RJSLoadingGaugeLimit(1000.0, 2000.0, RJSLoadingGaugeType.G1))
        val infra = Helpers.fullInfraFromRJS(rjsInfra, InfraMetadata("modified_tiny_infra"))

        // Check that we can go through the infra with a small train
        val normalPathResp =
            runPathfinding(
                infra,
                getPathfindingBlockRequest(
                    TestTrains.REALISTIC_FAST_TRAIN,
                    listOf(PathItem(waypointsStart, false), PathItem(waypointsEnd, false)),
                ),
            )
        checkPathfindingSuccess(normalPathResp, 10200.meters)

        // Check that we can't go through the infra with a large train
        assertThatThrownBy {
                runPathfinding(
                    infra,
                    getPathfindingBlockRequest(
                        TestTrains.FAST_TRAIN_LARGE_GAUGE,
                        listOf(PathItem(waypointsStart, false), PathItem(waypointsEnd, false)),
                    ),
                )
            }
            .isExactlyInstanceOf(NoPathFoundException::class.java)
            .satisfies({ exception: Throwable ->
                val resp =
                    (exception as NoPathFoundException).response
                        as IncompatibleConstraintsPathResponse
                assert(resp.relaxedConstraintsPath.length.distance == 10200.meters)
                assert(
                    resp.incompatibleConstraints.incompatibleGaugeRanges.single() ==
                        RangeValue<String>(
                            OffsetRange(Offset(1100.meters), Offset(2100.meters)),
                            null,
                        )
                )
            })

        // Check that we can go until right before the blocked section with a large train
        val closerWaypointsEnd = listOf(TrackLocation("ne.micro.foo_to_bar", Offset(1000.meters)))
        val shorterPathResp =
            runPathfinding(
                infra,
                getPathfindingBlockRequest(
                    TestTrains.REALISTIC_FAST_TRAIN,
                    listOf(PathItem(waypointsStart, false), PathItem(closerWaypointsEnd, false)),
                ),
            )
        checkPathfindingSuccess(shorterPathResp, 1100.meters)
    }

    @Test
    fun simpleRoutesInverted() {
        val waypointsStart = listOf(TrackLocation("ne.micro.bar_a", Offset(100.meters)))
        val waypointsEnd = listOf(TrackLocation("ne.micro.foo_b", Offset(100.meters)))
        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                listOf(PathItem(waypointsStart, false), PathItem(waypointsEnd, false)),
                "tiny_infra/infra.json",
            )
        checkPathfindingSuccess(
            parsed,
            10200.meters,
            expectedBlocks =
                listOf(
                    "[il.sig.C2-BAL];[buffer_stop_c, tde.track-bar];[]",
                    "[il.sig.C2-BAL, il.sig.C6-BAL];[tde.track-bar, tde.switch_foo-track];[]",
                    "[il.sig.C6-BAL];[tde.switch_foo-track, buffer_stop_b];[il.switch_foo-A_B1]",
                ),
            expectedRoutes =
                listOf(
                    "rt.buffer_stop_c->tde.track-bar",
                    "rt.tde.track-bar->tde.switch_foo-track",
                    "rt.tde.switch_foo-track->buffer_stop_b",
                ),
            expectedTrackSectionRanges =
                listOf(
                    TrackSectionRange(
                        "ne.micro.bar_a",
                        Offset(0.meters),
                        Offset(100.meters),
                        EdgeDirection.STOP_TO_START,
                    ),
                    TrackSectionRange(
                        "ne.micro.foo_to_bar",
                        Offset(0.meters),
                        Offset(10_000.meters),
                        EdgeDirection.STOP_TO_START,
                    ),
                    TrackSectionRange(
                        "ne.micro.foo_b",
                        Offset(100.meters),
                        Offset(200.meters),
                        EdgeDirection.STOP_TO_START,
                    ),
                ),
        )
    }

    @Test
    fun simpleRoutesSameEdge() {
        // Tests that we find a route path between two points on the same edge
        val waypointsStart = listOf(TrackLocation("ne.micro.bar_a", Offset(100.meters)))
        val waypointsEnd = listOf(TrackLocation("ne.micro.bar_a", Offset(110.meters)))
        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                listOf(PathItem(waypointsStart, false), PathItem(waypointsEnd, false)),
                "tiny_infra/infra.json",
            )
        checkPathfindingSuccess(
            parsed,
            10.meters,
            expectedBlocks = listOf("[il.sig.S7-BAL];[tde.track-bar, buffer_stop_c];[]"),
            expectedRoutes = listOf("rt.tde.foo_a-switch_foo->buffer_stop_c"),
            expectedTrackSectionRanges =
                listOf(
                    TrackSectionRange(
                        "ne.micro.bar_a",
                        Offset(100.meters),
                        Offset(110.meters),
                        EdgeDirection.START_TO_STOP,
                    )
                ),
        )
    }

    @Test
    fun simpleRoutesSameEdgeInverted() {
        val waypointsStart = listOf(TrackLocation("ne.micro.bar_a", Offset(110.meters)))
        val waypointsEnd = listOf(TrackLocation("ne.micro.bar_a", Offset(100.meters)))
        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                listOf(PathItem(waypointsStart, false), PathItem(waypointsEnd, false)),
                "tiny_infra/infra.json",
            )
        checkPathfindingSuccess(
            parsed,
            10.meters,
            expectedBlocks = listOf("[il.sig.C2-BAL];[buffer_stop_c, tde.track-bar];[]"),
            expectedRoutes = listOf("rt.buffer_stop_c->tde.track-bar"),
            expectedTrackSectionRanges =
                listOf(
                    TrackSectionRange(
                        "ne.micro.bar_a",
                        Offset(100.meters),
                        Offset(110.meters),
                        EdgeDirection.STOP_TO_START,
                    )
                ),
        )
    }

    @Test
    fun pathStartingAtTrackEdge() {
        /*
        foo_a   foo_to_bar   bar_a
        ------>|----------->|------>
              ^             ^
            start          end
        */
        val waypointsStart = listOf(TrackLocation("ne.micro.foo_a", Offset(200.meters)))
        val waypointsEnd = listOf(TrackLocation("ne.micro.bar_a", Offset(0.meters)))

        val infra = Helpers.fullInfraFromFile("tiny_infra/infra.json")

        // Check that we can go through the infra with a small train
        val normalPathResp =
            runPathfinding(
                infra,
                getPathfindingBlockRequest(
                    TestTrains.REALISTIC_FAST_TRAIN,
                    listOf(PathItem(waypointsStart, false), PathItem(waypointsEnd, false)),
                ),
            )
        checkPathfindingSuccess(
            normalPathResp,
            10000.meters,
            expectedBlocks =
                listOf(
                    "[il.sig.C1-BAL, il.sig.S7-BAL];[tde.foo_a-switch_foo, tde.track-bar];[il.switch_foo-A_B2]"
                ),
            expectedRoutes = listOf("rt.tde.foo_a-switch_foo->buffer_stop_c"),
            expectedTrackSectionRanges =
                listOf(
                    TrackSectionRange(
                        "ne.micro.foo_a",
                        Offset(200.meters),
                        Offset(200.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "ne.micro.foo_to_bar",
                        Offset(0.meters),
                        Offset(10_000.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "ne.micro.bar_a",
                        Offset(0.meters),
                        Offset(0.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                ),
        )
    }

    fun callPathfindingEndpoint(
        rs: RollingStock,
        pathItems: List<PathItem>,
        infra: String,
    ): PathfindingBlockResponse {
        val requestBody =
            pathfindingRequestAdapter.toJson(getPathfindingBlockRequest(rs, pathItems, infra))
        val response = PathfindingBlocksEndpoint(infraManager).act(RqFake(requestBody))
        val parsed = pathfindingResponseAdapter.fromJson(response.body())!!
        return parsed
    }
}

class PathfindingStopsAtEndOfBlock : ApiTest() {
    fun callPathfindingEndpoint(
        rs: RollingStock,
        pathItems: List<PathItem>,
        infra: String,
        stopsAtEndOfBlock: Boolean,
    ): PathfindingBlockResponse {
        val requestBody =
            pathfindingRequestAdapter.toJson(
                getPathfindingBlockRequest(rs, pathItems, infra, stopsAtEndOfBlock)
            )
        val response = PathfindingBlocksEndpoint(infraManager).act(RqFake(requestBody))
        val parsed = pathfindingResponseAdapter.fromJson(response.body())!!
        return parsed
    }

    private lateinit var waypoints: List<PathItem>
    private val firstIntermediateStopDistance = 12050.meters
    private val secondIntermediateStopDistance = 26500.meters
    private val reversedFirstIntermediateStopDistance = 19400.meters
    private val reversedSecondIntermediateStopDistance = 33850.meters

    @BeforeEach
    override fun setUp() {
        super.setUp()
        // West_Station
        val startWaypoint = TrackLocation("TA1", Offset(500.meters))
        // Mid_West_Station
        val firstIntermediateWaypoint = TrackLocation("TC1", Offset(550.meters))
        // Mid_East_Station
        val secondIntermediateWaypoint = TrackLocation("TD0", Offset(14000.meters))
        // South_East_Station
        val endWaypoint = TrackLocation("TH1", Offset(4400.meters))
        waypoints =
            listOf(
                PathItem(listOf(startWaypoint), false),
                PathItem(listOf(firstIntermediateWaypoint), false),
                PathItem(listOf(secondIntermediateWaypoint), false),
                PathItem(listOf(endWaypoint), false),
            )
    }

    @Test
    fun nonStopsAtEndOfBlockTest() {
        // Stops are not moved - nothing to do here

        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                waypoints,
                "small_infra/infra.json",
                false,
            )
        checkPathfindingSuccess(
            parsed,
            45900.meters,
            expectedIntermediatePathItemPosition =
                listOf(
                    Offset(firstIntermediateStopDistance),
                    Offset(secondIntermediateStopDistance),
                ),
        )
    }

    @Test
    fun reversedNonStopsAtEndOfBlockTest() {
        // Stops are not moved - nothing to do here

        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                waypoints.reversed(),
                "small_infra/infra.json",
                false,
            )
        checkPathfindingSuccess(
            parsed,
            45900.meters,
            expectedIntermediatePathItemPosition =
                listOf(
                    Offset(reversedFirstIntermediateStopDistance),
                    Offset(reversedSecondIntermediateStopDistance),
                ),
        )
    }

    @Test
    fun shortTrainTest() {
        // Only intermediate stops are moved to the end of their block
        val recalculatedFirstIntermediateStopDistance =
            firstIntermediateStopDistance + TestTrains.VERY_SHORT_FAST_TRAIN.length.meters
        val recalculatedSecondIntermediateStopDistance =
            secondIntermediateStopDistance + TestTrains.VERY_SHORT_FAST_TRAIN.length.meters

        val parsed =
            callPathfindingEndpoint(
                TestTrains.VERY_SHORT_FAST_TRAIN,
                waypoints,
                "small_infra/infra.json",
                true,
            )
        checkPathfindingSuccess(
            parsed,
            45900.meters,
            expectedIntermediatePathItemPosition =
                listOf(
                    Offset(recalculatedFirstIntermediateStopDistance),
                    Offset(recalculatedSecondIntermediateStopDistance),
                ),
        )
    }

    @Test
    fun reversedShortTrainTest() {
        // Only intermediate stops are moved to the end of their block
        val recalculatedFirstIntermediateStopDistance =
            reversedFirstIntermediateStopDistance + TestTrains.VERY_SHORT_FAST_TRAIN.length.meters
        val recalculatedSecondIntermediateStopDistance =
            reversedSecondIntermediateStopDistance + TestTrains.VERY_SHORT_FAST_TRAIN.length.meters

        val parsed =
            callPathfindingEndpoint(
                TestTrains.VERY_SHORT_FAST_TRAIN,
                waypoints.reversed(),
                "small_infra/infra.json",
                true,
            )
        checkPathfindingSuccess(
            parsed,
            45900.meters,
            expectedIntermediatePathItemPosition =
                listOf(
                    Offset(recalculatedFirstIntermediateStopDistance),
                    Offset(recalculatedSecondIntermediateStopDistance),
                ),
        )
    }

    @Test
    fun longTrainTest() {
        // The first intermediate stop is moved to the next block-delimiting signal, but the
        // distance available is less than the length of the train, so it is moved to the end of the
        // block (270 meters after the first intermediate stop)
        val recalculatedFirstIntermediateStopDistance = firstIntermediateStopDistance + 270.meters
        // The second intermediate stop is also moved to the end of the block (at the "DD0_9"
        // detector's position, 37.5 meters after the second intermediate stop)
        val recalculatedSecondIntermediateStopDistance =
            secondIntermediateStopDistance + 37.5.meters

        val parsed =
            callPathfindingEndpoint(
                TestTrains.VERY_LONG_FAST_TRAIN,
                waypoints,
                "small_infra/infra.json",
                true,
            )
        checkPathfindingSuccess(
            parsed,
            45900.meters,
            expectedIntermediatePathItemPosition =
                listOf(
                    Offset(recalculatedFirstIntermediateStopDistance),
                    Offset(recalculatedSecondIntermediateStopDistance),
                ),
        )
    }

    @Test
    fun reversedLongTrainTest() {
        // The first intermediate stop is moved to the next block-delimiting signal, but the
        // distance available is less than the length of the train, so it is moved to the end of the
        // block, the 9th block of the path (1500 meters after the first intermediate stop)
        val recalculatedFirstIntermediateStopDistance =
            reversedFirstIntermediateStopDistance + 1500.meters
        // The second intermediate stop is also moved to the end of the block, the 13th block of the
        // path (370 meters after the second intermediate stop)
        val recalculatedSecondIntermediateStopDistance =
            reversedSecondIntermediateStopDistance + 370.meters

        val parsed =
            callPathfindingEndpoint(
                TestTrains.VERY_LONG_FAST_TRAIN,
                waypoints.reversed(),
                "small_infra/infra.json",
                true,
            )
        checkPathfindingSuccess(
            parsed,
            45900.meters,
            expectedIntermediatePathItemPosition =
                listOf(
                    Offset(recalculatedFirstIntermediateStopDistance),
                    Offset(recalculatedSecondIntermediateStopDistance),
                ),
        )
    }

    @Test
    fun penultimateCorrectlyMovedJustBeforeDestination() {
        val startWaypoint = TrackLocation("TC1", Offset(500.meters))
        val intermediateWaypoint = TrackLocation("TD0", Offset(12550.meters))
        val endWaypoint = TrackLocation("TD0", Offset(13000.meters))
        val waypoints =
            listOf(
                PathItem(listOf(startWaypoint), false),
                PathItem(listOf(intermediateWaypoint), false),
                PathItem(listOf(endWaypoint), false),
            )

        val intermediateStopDistance = 13450.meters

        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                waypoints,
                "small_infra/infra.json",
                true,
            )
        checkPathfindingSuccess(
            parsed,
            13500.meters,
            expectedIntermediatePathItemPosition = listOf(Offset(intermediateStopDistance)),
        )
    }

    @Test
    fun penultimateStopNotMovedExactlyToDestination() {
        val startWaypoint = TrackLocation("TC1", Offset(500.meters))
        val intermediateWaypoint = TrackLocation("TD0", Offset(12600.meters))
        val endWaypoint = TrackLocation("TD0", Offset(13000.meters))
        val waypoints =
            listOf(
                PathItem(listOf(startWaypoint), false),
                PathItem(listOf(intermediateWaypoint), false),
                PathItem(listOf(endWaypoint), false),
            )

        // The intermediate stop is moved to the next block-delimiting signal, but the
        // distance available is more than the length of the train, so it would be moved by the
        // length of the train (400m) but this is also exactly the destination so the intermediate
        // stop remains the same
        val intermediateStopDistance = 13100.meters

        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                waypoints,
                "small_infra/infra.json",
                true,
            )
        checkPathfindingSuccess(
            parsed,
            13500.meters,
            expectedIntermediatePathItemPosition = listOf(Offset(intermediateStopDistance)),
        )
    }

    @Test
    fun penultimateStopTooCloseToDestination() {
        val startWaypoint = TrackLocation("TC1", Offset(500.meters))
        val intermediateWaypoint = TrackLocation("TD0", Offset(12990.meters))
        val endWaypoint = TrackLocation("TD0", Offset(13000.meters))
        val waypoints =
            listOf(
                PathItem(listOf(startWaypoint), false),
                PathItem(listOf(intermediateWaypoint), false),
                PathItem(listOf(endWaypoint), false),
            )

        // The intermediate stop is moved to the next block-delimiting signal, but the
        // distance available is more than the length of the train, so it would be moved by the
        // length of the train, but that is after the destination so the intermediate stop remains
        // the same
        val intermediateStopDistance = 13490.meters

        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                waypoints,
                "small_infra/infra.json",
                true,
            )
        checkPathfindingSuccess(
            parsed,
            13500.meters,
            expectedIntermediatePathItemPosition = listOf(Offset(intermediateStopDistance)),
        )
    }

    @Test
    fun twoPenultimatesStopTooCloseToDestination() {
        val startWaypoint = TrackLocation("TC1", Offset(500.meters))
        val intermediateWaypoint = TrackLocation("TD0", Offset(12950.meters))
        val secondIntermediateWaypoint = TrackLocation("TD0", Offset(12990.meters))
        val endWaypoint = TrackLocation("TD0", Offset(13000.meters))
        val waypoints =
            listOf(
                PathItem(listOf(startWaypoint), false),
                PathItem(listOf(intermediateWaypoint), false),
                PathItem(listOf(secondIntermediateWaypoint), false),
                PathItem(listOf(endWaypoint), false),
            )

        // The intermediate stops are moved to the next block-delimiting signal, but the
        // distance available is more than the length of the train, so it would be moved by the
        // length of the train, but that is after the destination so the intermediate stops remains
        // the same
        val intermediateStopDistance = 13450.meters
        val secondIntermediateStopDistance = 13490.meters

        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                waypoints,
                "small_infra/infra.json",
                true,
            )
        checkPathfindingSuccess(
            parsed,
            13500.meters,
            expectedIntermediatePathItemPosition =
                listOf(Offset(intermediateStopDistance), Offset(secondIntermediateStopDistance)),
        )
    }

    @Test
    fun simpleBacktrackingYInfraTest() {
        val waypointsStart = listOf(TrackLocation("t_a", Offset(3100.meters)))
        val waypointsBacktracking = listOf(TrackLocation("t_center", Offset(2800.meters)))
        val waypointsEnd = listOf(TrackLocation("t_b", Offset(3400.meters)))
        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                listOf(
                    PathItem(waypointsStart, false),
                    PathItem(waypointsBacktracking, true),
                    PathItem(waypointsEnd, false),
                ),
                "y_infra/infra.json",
                false,
            )
        checkPathfindingSuccess(
            parsed,
            18_700.meters,
            expectedBlocks =
                listOf(
                    "[s.right.a1-BAL, s.right.a2-BAL];[det.a1, det.a2];[]",
                    "[s.right.a2-BAL, s.right.a3-BAL];[det.a2, det.a3];[]",
                    "[s.right.a3-BAL, s.right.c2-BAL];[det.a3, det.c2];[switch-A_B1]",
                    "[s.left.c3-BAL, s.left.c1-BAL];[det.c3, det.c1];[]",
                    "[s.left.c1-BAL, s.left.b2-BAL];[det.c1, det.b2];[switch-A_B2]",
                    "[s.left.b2-BAL, s.left.b1-BAL];[det.b2, det.b1];[]",
                ),
            expectedRoutes =
                listOf("rt.bf.a->det.a3", "rt.det.a3->bf.c", "rt.bf.c->det.c1", "rt.det.c1->bf.b"),
            expectedTrackSectionRanges =
                listOf(
                    TrackSectionRange(
                        "t_a",
                        Offset(3_100.meters),
                        Offset(10_000.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "t_center",
                        Offset(0.meters),
                        Offset(2_800.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "t_center",
                        Offset(0.meters),
                        Offset(2_400.meters),
                        EdgeDirection.STOP_TO_START,
                    ),
                    TrackSectionRange(
                        "t_b",
                        Offset(3_400.meters),
                        Offset(10_000.meters),
                        EdgeDirection.STOP_TO_START,
                    ),
                ),
            expectedIntermediatePathItemPosition = listOf(Offset(9_700.meters)),
        )
    }

    @Test
    fun backtrackingOverRouteDelimiterYInfraTest() {
        val waypointsStart = listOf(TrackLocation("t_a", Offset(3100.meters)))
        val waypointsBacktracking = listOf(TrackLocation("t_center", Offset(1100.meters)))
        val waypointsEnd = listOf(TrackLocation("t_b", Offset(3400.meters)))
        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                listOf(
                    PathItem(waypointsStart, false),
                    PathItem(waypointsBacktracking, true),
                    PathItem(waypointsEnd, false),
                ),
                "y_infra/infra.json",
                false,
            )
        checkPathfindingSuccess(
            parsed,
            15_300.meters,
            expectedBlocks =
                listOf(
                    "[s.right.a1-BAL, s.right.a2-BAL];[det.a1, det.a2];[]",
                    "[s.right.a2-BAL, s.right.a3-BAL];[det.a2, det.a3];[]",
                    "[s.right.a3-BAL, s.right.c2-BAL];[det.a3, det.c2];[switch-A_B1]",
                    "[s.left.c1-BAL, s.left.b2-BAL];[det.c1, det.b2];[switch-A_B2]",
                    "[s.left.b2-BAL, s.left.b1-BAL];[det.b2, det.b1];[]",
                ),
            expectedRoutes = listOf("rt.bf.a->det.a3", "rt.det.a3->bf.c", "rt.det.c1->bf.b"),
            expectedTrackSectionRanges =
                listOf(
                    TrackSectionRange(
                        "t_a",
                        Offset(3_100.meters),
                        Offset(10_000.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "t_center",
                        Offset(0.meters),
                        Offset(1_100.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "t_center",
                        Offset(0.meters),
                        Offset(700.meters),
                        EdgeDirection.STOP_TO_START,
                    ),
                    TrackSectionRange(
                        "t_b",
                        Offset(3_400.meters),
                        Offset(10_000.meters),
                        EdgeDirection.STOP_TO_START,
                    ),
                ),
            expectedIntermediatePathItemPosition = listOf(Offset(8_000.meters)),
        )
    }

    @Test
    fun backtrackingShortlyAfterRouteDelimiterYInfraTest() {
        val waypointsStart = listOf(TrackLocation("t_a", Offset(3100.meters)))
        val waypointsBacktracking = listOf(TrackLocation("t_center", Offset(1500.meters)))
        val waypointsEnd = listOf(TrackLocation("t_b", Offset(3100.meters)))
        val parsed =
            callPathfindingEndpoint(
                TestTrains.REALISTIC_FAST_TRAIN,
                listOf(
                    PathItem(waypointsStart, false),
                    PathItem(waypointsBacktracking, true),
                    PathItem(waypointsEnd, false),
                ),
                "y_infra/infra.json",
                false,
            )
        checkPathfindingSuccess(
            parsed,
            16_400.meters,
            expectedBlocks =
                listOf(
                    "[s.right.a1-BAL, s.right.a2-BAL];[det.a1, det.a2];[]",
                    "[s.right.a2-BAL, s.right.a3-BAL];[det.a2, det.a3];[]",
                    "[s.right.a3-BAL, s.right.c2-BAL];[det.a3, det.c2];[switch-A_B1]",
                    "[s.left.c3-BAL, s.left.c1-BAL];[det.c3, det.c1];[]",
                    "[s.left.c1-BAL, s.left.b2-BAL];[det.c1, det.b2];[switch-A_B2]",
                    "[s.left.b2-BAL, s.left.b1-BAL];[det.b2, det.b1];[]",
                ),
            expectedRoutes =
                listOf("rt.bf.a->det.a3", "rt.det.a3->bf.c", "rt.bf.c->det.c1", "rt.det.c1->bf.b"),
            expectedTrackSectionRanges =
                listOf(
                    TrackSectionRange(
                        "t_a",
                        Offset(3_100.meters),
                        Offset(10_000.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "t_center",
                        Offset(0.meters),
                        Offset(1_500.meters),
                        EdgeDirection.START_TO_STOP,
                    ),
                    TrackSectionRange(
                        "t_center",
                        Offset(0.meters),
                        Offset(1_100.meters),
                        EdgeDirection.STOP_TO_START,
                    ),
                    TrackSectionRange(
                        "t_b",
                        Offset(3_100.meters),
                        Offset(10_000.meters),
                        EdgeDirection.STOP_TO_START,
                    ),
                ),
            expectedIntermediatePathItemPosition = listOf(Offset(8_400.meters)),
        )
    }
}
