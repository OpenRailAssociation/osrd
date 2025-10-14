package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.api.TrackLocation
import fr.sncf.osrd.api.pathfinding.*
import fr.sncf.osrd.path.interfaces.JsonTrainPath.TrackSectionRange
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSLoadingGaugeLimit
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.md5
import fr.sncf.osrd.utils.takes.TakesUtils
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.assertj.core.api.AssertionsForClassTypes
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.takes.rq.RqFake

fun getPathfindingBlockRequest(
    rs: RollingStock,
    pathItems: List<Collection<TrackLocation>>,
    infra: String = "unused_name",
): PathfindingBlockRequest {
    return PathfindingBlockRequest(
        rs.loadingGaugeType,
        rs.isThermal,
        rs.modeNames.filterNot { it == "thermal" },
        rs.supportedSignalingSystems.toList(),
        rs.maxSpeed,
        rs.length,
        null,
        null,
        infra,
        1,
        pathItems,
    )
}

fun checkPathfindingSuccess(
    pathResp: PathfindingBlockResponse,
    expectedLength: Distance,
    expectedTrackSectionRanges: List<TrackSectionRange>? = null,
    expectedBlocks: List<String>? = null,
    expectedRoutes: List<String>? = null,
    expectedIntermediatePathItemPosition: List<Offset<TravelledPath>> = listOf(),
): PathfindingBlockSuccess {
    assertThat(pathResp).isExactlyInstanceOf(PathfindingBlockSuccess::class.java)
    val pathSuccess = pathResp as PathfindingBlockSuccess

    AssertionsForClassTypes.assertThat(pathSuccess.length.distance).isEqualTo(expectedLength)
    val expectedPathItemsPos =
        listOf(Offset<TravelledPath>(0.meters))
            .plus(expectedIntermediatePathItemPosition)
            .plusElement(Offset(pathSuccess.length.distance))
    assertEquals(expectedPathItemsPos, pathSuccess.pathItemPositions)

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
                listOf(waypointsStart, waypointsEnd),
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
        val waypointsStart = listOf(waypointStart)
        val waypointsEnd = listOf(waypointEnd)
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
        val unconstrainedRawResponse =
            PathfindingBlocksEndpoint(infraManager)
                .act(RqFake("POST", "/pathfinding/blocks", unconstrainedRequestBody))
        val unconstrainedResponse = TakesUtils.readBodyResponse(unconstrainedRawResponse)
        val unconstrainedParsed =
            (pathfindingResponseAdapter.fromJson(unconstrainedResponse)
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
        val rawResponse =
            PathfindingBlocksEndpoint(infraManager)
                .act(RqFake("POST", "/pathfinding/blocks", requestBody))
        val response = TakesUtils.readBodyResponse(rawResponse)
        val parsed =
            (pathfindingResponseAdapter.fromJson(response)
                as? IncompatibleConstraintsPathResponse)!!
        assert(parsed.relaxedConstraintsPath == unconstrainedParsed)
        assert(
            parsed.incompatibleConstraints ==
                IncompatibleConstraints(
                    incompatibleElectrificationRanges =
                        listOf(
                            RangeValue(
                                Pathfinding.Range(Offset.zero(), Offset(10250.meters)),
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
        val waypointsStart = listOf(waypointStart)
        val waypointsEnd = listOf(waypointEnd)
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
        val unconstrainedRawResponse =
            PathfindingBlocksEndpoint(infraManager)
                .act(RqFake("POST", "/pathfinding/blocks", unconstrainedRequestBody))
        val unconstrainedResponse = TakesUtils.readBodyResponse(unconstrainedRawResponse)
        val unconstrainedParsed =
            (pathfindingResponseAdapter.fromJson(unconstrainedResponse)
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
        val rawResponse =
            PathfindingBlocksEndpoint(infraManager)
                .act(RqFake("POST", "/pathfinding/blocks", requestBody))
        val response = TakesUtils.readBodyResponse(rawResponse)
        val parsed =
            (pathfindingResponseAdapter.fromJson(response)
                as? IncompatibleConstraintsPathResponse)!!
        assert(parsed.relaxedConstraintsPath == unconstrainedParsed)
        assert(
            parsed.incompatibleConstraints ==
                IncompatibleConstraints(
                    incompatibleElectrificationRanges =
                        listOf(
                            RangeValue(
                                Pathfinding.Range(Offset.zero(), Offset(1960.meters)),
                                "1500V",
                            ),
                            // neutral section in-between
                            RangeValue(
                                Pathfinding.Range(Offset(2010.meters), Offset(4000.meters)),
                                "25000V",
                            ),
                        ),
                    // multiple different loading gauges on the track
                    incompatibleGaugeRanges =
                        listOf(
                            RangeValue(Pathfinding.Range(Offset.zero(), Offset(100.meters)), null),
                            RangeValue(
                                Pathfinding.Range(Offset(100.meters), Offset(200.meters)),
                                null,
                            ),
                            RangeValue(
                                Pathfinding.Range(Offset(200.meters), Offset(1500.meters)),
                                null,
                            ),
                            RangeValue(
                                Pathfinding.Range(Offset(1500.meters), Offset(1900.meters)),
                                null,
                            ),
                        ),
                    incompatibleSignalingSystemRanges =
                        listOf(
                            RangeValue(Pathfinding.Range(Offset.zero(), Offset(4000.meters)), "BAL")
                        ),
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
                listOf(waypointsStart, waypointsMid, waypointsEnd),
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
                    listOf(waypointsStart, waypointsEnd),
                    "tiny_infra/infra.json",
                )
            )
        val rawResponse =
            PathfindingBlocksEndpoint(infraManager)
                .act(RqFake("POST", "/pathfinding/blocks", requestBody))
        val headers = TakesUtils.readHeadResponse(rawResponse)
        assert(headers.contains("HTTP/1.1 200 OK"))
        val response = TakesUtils.readBodyResponse(rawResponse)
        val parsed = (pathfindingResponseAdapter.fromJson(response) as? NotFoundInBlocks)!!
        AssertionsForClassTypes.assertThat(parsed).isNotNull
    }

    @Test
    fun missingTrackTest() {
        val waypointsStart = listOf(TrackLocation("this_track_does_not_exist", Offset(0.meters)))
        val requestBody =
            pathfindingRequestAdapter.toJson(
                getPathfindingBlockRequest(
                    TestTrains.REALISTIC_FAST_TRAIN,
                    listOf(waypointsStart),
                    "tiny_infra/infra.json",
                )
            )
        val rawResponse =
            PathfindingBlocksEndpoint(infraManager)
                .act(RqFake("POST", "/pathfinding/blocks", requestBody))
        val headers = TakesUtils.readHeadResponse(rawResponse)
        assert(headers.contains("HTTP/1.1 200 OK"))
        val response = TakesUtils.readBodyResponse(rawResponse)
        val parsed = (pathfindingResponseAdapter.fromJson(response) as? PathfindingFailed)!!
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
        val infra = Helpers.fullInfraFromRJS(rjsInfra)

        // Check that we can go through the infra with a small train
        val normalPathResp =
            runPathfinding(
                infra,
                getPathfindingBlockRequest(
                    TestTrains.REALISTIC_FAST_TRAIN,
                    listOf(waypointsStart, waypointsEnd),
                ),
            )
        checkPathfindingSuccess(normalPathResp, 10200.meters)

        // Check that we can't go through the infra with a large train
        assertThatThrownBy {
                runPathfinding(
                    infra,
                    getPathfindingBlockRequest(
                        TestTrains.FAST_TRAIN_LARGE_GAUGE,
                        listOf(waypointsStart, waypointsEnd),
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
                            Pathfinding.Range(Offset(1100.meters), Offset(2100.meters)),
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
                    listOf(waypointsStart, closerWaypointsEnd),
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
                listOf(waypointsStart, waypointsEnd),
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
                listOf(waypointsStart, waypointsEnd),
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
                listOf(waypointsStart, waypointsEnd),
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

        val rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json")
        val infra = Helpers.fullInfraFromRJS(rjsInfra)

        // Check that we can go through the infra with a small train
        val normalPathResp =
            runPathfinding(
                infra,
                getPathfindingBlockRequest(
                    TestTrains.REALISTIC_FAST_TRAIN,
                    listOf(waypointsStart, waypointsEnd),
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
        pathItems: List<Collection<TrackLocation>>,
        infra: String,
    ): PathfindingBlockResponse {
        val requestBody =
            pathfindingRequestAdapter.toJson(getPathfindingBlockRequest(rs, pathItems, infra))
        val rawResponse =
            PathfindingBlocksEndpoint(infraManager)
                .act(RqFake("POST", "/pathfinding/blocks", requestBody))
        val response = TakesUtils.readBodyResponse(rawResponse)
        val parsed = pathfindingResponseAdapter.fromJson(response)!!
        return parsed
    }
}
