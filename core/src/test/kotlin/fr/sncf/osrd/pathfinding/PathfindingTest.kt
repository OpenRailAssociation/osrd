package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.api.DirectionalTrackRange
import fr.sncf.osrd.api.TrackLocation
import fr.sncf.osrd.api.pathfinding.*
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSLoadingGaugeLimit
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.md5
import fr.sncf.osrd.utils.takes.TakesUtils
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
    infra: String = "unused_name"
): PathfindingBlockRequest {
    return PathfindingBlockRequest(
        rs.loadingGaugeType,
        rs.isThermal,
        rs.modeNames.filterNot { it == "thermal" }.toList(),
        rs.supportedSignalingSystems.toList(),
        rs.maxSpeed,
        rs.length,
        null,
        infra,
        1,
        pathItems
    )
}

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PathfindingTest : ApiTest() {
    @Test
    fun simpleTinyInfraTest() {
        val waypointsStart = listOf(TrackLocation("ne.micro.foo_b", Offset(50.meters)))
        val waypointsEnd = listOf(TrackLocation("ne.micro.bar_a", Offset(100.meters)))
        val requestBody =
            pathfindingRequestAdapter.toJson(
                getPathfindingBlockRequest(
                    TestTrains.REALISTIC_FAST_TRAIN,
                    listOf(waypointsStart, waypointsEnd),
                    "tiny_infra/infra.json"
                )
            )
        val rawResponse =
            PathfindingBlocksEndpoint(infraManager)
                .act(RqFake("POST", "/pathfinding/blocks", requestBody))
        val response = TakesUtils.readBodyResponse(rawResponse)
        val parsed = (pathfindingResponseAdapter.fromJson(response) as? PathfindingBlockSuccess)!!
        AssertionsForClassTypes.assertThat(parsed.length.distance).isEqualTo(10250.meters)
        assertEquals(
            listOf(Offset(0.meters), Offset(parsed.length.distance)),
            parsed.pathItemPositions
        )
        assertEquals(
            listOf(
                    "[il.sig.C3-BAL];[buffer_stop_b, tde.foo_b-switch_foo];[]",
                    "[il.sig.C3-BAL, il.sig.S7-BAL];[tde.foo_b-switch_foo, tde.track-bar];[il.switch_foo-A_B1]",
                    "[il.sig.S7-BAL];[tde.track-bar, buffer_stop_c];[]"
                )
                .map { "block.${md5(it)}" },
            parsed.blocks
        )

        assertEquals(
            listOf(
                "rt.buffer_stop_b->tde.foo_b-switch_foo",
                "rt.tde.foo_b-switch_foo->buffer_stop_c"
            ),
            parsed.routes
        )
        assertEquals(
            listOf(
                DirectionalTrackRange(
                    "ne.micro.foo_b",
                    Offset(50.meters),
                    Offset(200.meters),
                    EdgeDirection.START_TO_STOP
                ),
                DirectionalTrackRange(
                    "ne.micro.foo_to_bar",
                    Offset(0.meters),
                    Offset(10_000.meters),
                    EdgeDirection.START_TO_STOP
                ),
                DirectionalTrackRange(
                    "ne.micro.bar_a",
                    Offset(0.meters),
                    Offset(100.meters),
                    EdgeDirection.START_TO_STOP
                )
            ),
            parsed.trackSectionRanges
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
                                "" // range not electrified
                            )
                        ),
                    incompatibleGaugeRanges = listOf(),
                    incompatibleSignalingSystemRanges = listOf()
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
                                "1500V"
                            ),
                            // neutral section in-between
                            RangeValue(
                                Pathfinding.Range(Offset(2010.meters), Offset(4000.meters)),
                                "25000V"
                            )
                        ),
                    // multiple different loading gauges on the track
                    incompatibleGaugeRanges =
                        listOf(
                            RangeValue(Pathfinding.Range(Offset.zero(), Offset(100.meters)), null),
                            RangeValue(
                                Pathfinding.Range(Offset(100.meters), Offset(200.meters)),
                                null
                            ),
                            RangeValue(
                                Pathfinding.Range(Offset(200.meters), Offset(1500.meters)),
                                null
                            ),
                            RangeValue(
                                Pathfinding.Range(Offset(1500.meters), Offset(1900.meters)),
                                null
                            )
                        ),
                    incompatibleSignalingSystemRanges =
                        listOf(
                            RangeValue(Pathfinding.Range(Offset.zero(), Offset(4000.meters)), "BAL")
                        )
                )
        )
    }

    @Test
    fun testMiddleStop() {
        val waypointsStart = listOf(TrackLocation("ne.micro.foo_b", Offset(100.meters)))
        val waypointsMid = listOf(TrackLocation("ne.micro.foo_to_bar", Offset(5000.meters)))
        val waypointsEnd = listOf(TrackLocation("ne.micro.bar_a", Offset(100.meters)))
        val requestBody =
            pathfindingRequestAdapter.toJson(
                getPathfindingBlockRequest(
                    TestTrains.REALISTIC_FAST_TRAIN,
                    listOf(waypointsStart, waypointsMid, waypointsEnd),
                    "tiny_infra/infra.json"
                )
            )
        val rawResponse =
            PathfindingBlocksEndpoint(infraManager)
                .act(RqFake("POST", "/pathfinding/blocks", requestBody))
        val response = TakesUtils.readBodyResponse(rawResponse)
        val parsed = (pathfindingResponseAdapter.fromJson(response) as? PathfindingBlockSuccess)!!
        AssertionsForClassTypes.assertThat(parsed.length.distance).isEqualTo(10200.meters)
        assertEquals(
            listOf(Offset(0.meters), Offset(5100.meters), Offset(parsed.length.distance)),
            parsed.pathItemPositions
        )
        assertEquals(
            listOf(
                    "[il.sig.C3-BAL];[buffer_stop_b, tde.foo_b-switch_foo];[]",
                    "[il.sig.C3-BAL, il.sig.S7-BAL];[tde.foo_b-switch_foo, tde.track-bar];[il.switch_foo-A_B1]",
                    "[il.sig.S7-BAL];[tde.track-bar, buffer_stop_c];[]"
                )
                .map { "block.${md5(it)}" },
            parsed.blocks
        )

        assertEquals(
            listOf(
                "rt.buffer_stop_b->tde.foo_b-switch_foo",
                "rt.tde.foo_b-switch_foo->buffer_stop_c"
            ),
            parsed.routes
        )
        assertEquals(
            listOf(
                DirectionalTrackRange(
                    "ne.micro.foo_b",
                    Offset(100.meters),
                    Offset(200.meters),
                    EdgeDirection.START_TO_STOP
                ),
                DirectionalTrackRange(
                    "ne.micro.foo_to_bar",
                    Offset(0.meters),
                    Offset(10_000.meters),
                    EdgeDirection.START_TO_STOP
                ),
                DirectionalTrackRange(
                    "ne.micro.bar_a",
                    Offset(0.meters),
                    Offset(100.meters),
                    EdgeDirection.START_TO_STOP
                )
            ),
            parsed.trackSectionRanges
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
                    "tiny_infra/infra.json"
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
                    "tiny_infra/infra.json"
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
                    listOf(waypointsStart, waypointsEnd)
                )
            )
        assertThat(normalPathResp).isExactlyInstanceOf(PathfindingBlockSuccess::class.java)
        assertThat((normalPathResp as PathfindingBlockSuccess).length.distance)
            .isEqualTo(10200.meters)

        // Check that we can't go through the infra with a large train
        assertThatThrownBy {
                runPathfinding(
                    infra,
                    getPathfindingBlockRequest(
                        TestTrains.FAST_TRAIN_LARGE_GAUGE,
                        listOf(waypointsStart, waypointsEnd)
                    )
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
                            null
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
                    listOf(waypointsStart, closerWaypointsEnd)
                )
            )
        assertThat(shorterPathResp).isExactlyInstanceOf(PathfindingBlockSuccess::class.java)
        assertThat((shorterPathResp as PathfindingBlockSuccess).length.distance)
            .isEqualTo(1100.meters)
    }

    /*
    @Test
    @Throws(IOException::class, URISyntaxException::class)
    fun noElectrificationThrowsForElectricTrain() {
        val waypointStart = PathfindingWaypoint("TA1", 1550.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("TH0", 103.0, EdgeDirection.START_TO_STOP)
        val waypoints = Array(2) { Array(1) { waypointStart } }
        waypoints[1][0] = waypointEnd
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        rjsInfra.electrifications = ArrayList()
        AssertionsForClassTypes.assertThatThrownBy {
            runPathfinding(
                Helpers.fullInfraFromRJS(rjsInfra),
                waypoints,
                listOf(TestTrains.FAST_ELECTRIC_TRAIN),
                null
            )
        }
            .isExactlyInstanceOf(OSRDError::class.java)
            .satisfies({ exception ->
                AssertionsForClassTypes.assertThat((exception as OSRDError?)!!.osrdErrorType)
                    .isEqualTo(ErrorType.PathfindingElectrificationError)
                AssertionsForClassTypes.assertThat((exception as OSRDError?)!!.context)
                    .isEqualTo(mapOf<String, Any>())
            })
    }

    @Test
    @Throws(Exception::class)
    fun simpleRoutesInverted() {
        val waypointStart =
            PathfindingWaypoint("ne.micro.bar_a", 100.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("ne.micro.foo_b", 100.0, EdgeDirection.START_TO_STOP)
        val waypointsStart = makeBidirectionalEndPoint(waypointStart)
        val waypointsEnd = makeBidirectionalEndPoint(waypointEnd)
        val waypoints: Array<Array<PathfindingWaypoint>> = Array(2) { waypointsStart }
        waypoints[1] = waypointsEnd
        val requestBody =
            PathfindingRequest.adapter.toJson(
                PathfindingRequest(waypoints, "tiny_infra/infra.json", "", listOf(), null)
            )
        val result =
            TakesUtils.readBodyResponse(
                PathfindingBlocksEndpoint(infraManager)
                    .act(RqFake("POST", "/pathfinding/routes", requestBody))
            )
        val response = PathfindingResult.adapterResult.fromJson(result)!!
        val expectedRoutePaths =
            listOf(
                RJSRoutePath(
                    "rt.buffer_stop_c->tde.track-bar",
                    listOf(
                        RJSDirectionalTrackRange(
                            "ne.micro.bar_a",
                            25.0,
                            100.0,
                            EdgeDirection.STOP_TO_START
                        )
                    ),
                    SIGNALING_TYPE
                ),
                RJSRoutePath(
                    "rt.tde.track-bar->tde.switch_foo-track",
                    listOf(
                        RJSDirectionalTrackRange(
                            "ne.micro.bar_a",
                            0.0,
                            25.0,
                            EdgeDirection.STOP_TO_START
                        ),
                        RJSDirectionalTrackRange(
                            "ne.micro.foo_to_bar",
                            25.0,
                            10000.0,
                            EdgeDirection.STOP_TO_START
                        )
                    ),
                    SIGNALING_TYPE
                ),
                RJSRoutePath(
                    "rt.tde.switch_foo-track->buffer_stop_b",
                    listOf(
                        RJSDirectionalTrackRange(
                            "ne.micro.foo_to_bar",
                            0.0,
                            25.0,
                            EdgeDirection.STOP_TO_START
                        ),
                        RJSDirectionalTrackRange(
                            "ne.micro.foo_b",
                            100.0,
                            200.0,
                            EdgeDirection.STOP_TO_START
                        )
                    ),
                    SIGNALING_TYPE
                )
            )
        AssertionsForClassTypes.assertThat(response.routePaths).isEqualTo(expectedRoutePaths)
        val expectedPathWaypoints =
            listOf(
                PathWaypointResult(
                    PathWaypointLocation("ne.micro.bar_a", 100.0),
                    0.0,
                    false,
                    "op.station_bar"
                ),
                PathWaypointResult(
                    PathWaypointLocation("ne.micro.foo_b", 100.0),
                    10200.0,
                    false,
                    "op.station_foo"
                )
            )
        AssertionsForClassTypes.assertThat(response.pathWaypoints).isEqualTo(expectedPathWaypoints)
        expectWaypointInPathResult(response, waypointStart)
        expectWaypointInPathResult(response, waypointEnd)
    }

    /** Tests that we find a route path between two points on the same edge */
    @ParameterizedTest
    @MethodSource("simpleRoutesSameEdgeArgs")
    @Throws(Exception::class)
    fun simpleRoutesSameEdge(
        inverted: Boolean,
        expectedRoutePaths: List<RJSRoutePath?>?,
        expectedPathWaypoints: List<PathWaypointResult?>?
    ) {
        var waypointStart =
            PathfindingWaypoint("ne.micro.bar_a", 100.0, EdgeDirection.START_TO_STOP)
        var waypointEnd = PathfindingWaypoint("ne.micro.bar_a", 110.0, EdgeDirection.START_TO_STOP)
        if (inverted) {
            val tmp = waypointEnd
            waypointEnd = waypointStart
            waypointStart = tmp
        }
        val waypointsStart = makeBidirectionalEndPoint(waypointStart)
        val waypointsEnd = makeBidirectionalEndPoint(waypointEnd)
        val waypoints: Array<Array<PathfindingWaypoint>> = Array(2) { waypointsStart }
        waypoints[1] = waypointsEnd
        val requestBody =
            PathfindingRequest.adapter.toJson(
                PathfindingRequest(waypoints, "tiny_infra/infra.json", "", listOf(), null)
            )
        val result =
            TakesUtils.readBodyResponse(
                PathfindingBlocksEndpoint(infraManager)
                    .act(RqFake("POST", "/pathfinding/routes", requestBody))
            )
        val response = PathfindingResult.adapterResult.fromJson(result)!!
        AssertionsForClassTypes.assertThat(response.routePaths).isEqualTo(expectedRoutePaths)
        AssertionsForClassTypes.assertThat(response.pathWaypoints).isEqualTo(expectedPathWaypoints)
        expectWaypointInPathResult(response, waypointStart)
        expectWaypointInPathResult(response, waypointEnd)
    }

    @Test
    @Throws(IOException::class)
    fun testCurveGraph() {
        val waypointStart = PathfindingWaypoint("TF1", 0.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("TF1", 6500.0, EdgeDirection.START_TO_STOP)
        val waypointsStart = makeBidirectionalEndPoint(waypointStart)
        val waypointsEnd = makeBidirectionalEndPoint(waypointEnd)
        val waypoints: Array<Array<PathfindingWaypoint>> = Array(2) { waypointsStart }
        waypoints[1] = waypointsEnd
        val requestBody =
            PathfindingRequest.adapter.toJson(
                PathfindingRequest(waypoints, "small_infra/infra.json", "1", listOf(), null)
            )
        val result =
            TakesUtils.readBodyResponse(
                PathfindingBlocksEndpoint(infraManager)
                    .act(RqFake("POST", "/pathfinding/routes", requestBody))
            )
        val response = PathfindingResult.adapterResult.fromJson(result)!!
        Assertions.assertIterableEquals(
            listOf(
                CurveChartPointResult(0.0, 0.0),
                CurveChartPointResult(3100.0, 0.0),
                CurveChartPointResult(3100.0, 9500.0),
                CurveChartPointResult(4400.0, 9500.0),
                CurveChartPointResult(4400.0, 0.0),
                CurveChartPointResult(6500.0, 0.0)
            ),
            response.curves
        )
    }

    @Test
    @Throws(IOException::class)
    fun testCurveGraphStopToStart() {
        val waypointStart = PathfindingWaypoint("TF1", 6500.0, EdgeDirection.STOP_TO_START)
        val waypointEnd = PathfindingWaypoint("TF1", 0.0, EdgeDirection.STOP_TO_START)
        val waypointsStart = makeBidirectionalEndPoint(waypointStart)
        val waypointsEnd = makeBidirectionalEndPoint(waypointEnd)
        val waypoints: Array<Array<PathfindingWaypoint>> = Array(2) { waypointsStart }
        waypoints[1] = waypointsEnd
        val requestBody =
            PathfindingRequest.adapter.toJson(
                PathfindingRequest(waypoints, "small_infra/infra.json", "1", listOf(), null)
            )
        val result =
            TakesUtils.readBodyResponse(
                PathfindingBlocksEndpoint(infraManager)
                    .act(RqFake("POST", "/pathfinding/routes", requestBody))
            )
        val response = PathfindingResult.adapterResult.fromJson(result)!!
        Assertions.assertIterableEquals(
            listOf(
                CurveChartPointResult(0.0, 0.0),
                CurveChartPointResult(2100.0, 0.0),
                CurveChartPointResult(2100.0, -9500.0),
                CurveChartPointResult(3400.0, -9500.0),
                CurveChartPointResult(3400.0, 0.0),
                CurveChartPointResult(6500.0, 0.0)
            ),
            response.curves
        )
    }

    @Test
    @Throws(IOException::class)
    fun testSlopeGraph() {
        val waypointStart = PathfindingWaypoint("TD0", 0.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("TD0", 25000.0, EdgeDirection.START_TO_STOP)
        val waypointsStart = makeBidirectionalEndPoint(waypointStart)
        val waypointsEnd = makeBidirectionalEndPoint(waypointEnd)
        val waypoints: Array<Array<PathfindingWaypoint>> = Array(2) { waypointsStart }
        waypoints[1] = waypointsEnd
        val requestBody =
            PathfindingRequest.adapter.toJson(
                PathfindingRequest(waypoints, "small_infra/infra.json", "1", listOf(), null)
            )
        val result =
            TakesUtils.readBodyResponse(
                PathfindingBlocksEndpoint(infraManager)
                    .act(RqFake("POST", "/pathfinding/routes", requestBody))
            )
        val response = PathfindingResult.adapterResult.fromJson(result)!!
        Assertions.assertIterableEquals(
            listOf(
                SlopeChartPointResult(0.0, 0.0),
                SlopeChartPointResult(6000.0, 0.0),
                SlopeChartPointResult(6000.0, 3.0),
                SlopeChartPointResult(7000.0, 3.0),
                SlopeChartPointResult(7000.0, 6.0),
                SlopeChartPointResult(8000.0, 6.0),
                SlopeChartPointResult(8000.0, 3.0),
                SlopeChartPointResult(9000.0, 3.0),
                SlopeChartPointResult(9000.0, 0.0),
                SlopeChartPointResult(14000.0, 0.0),
                SlopeChartPointResult(14000.0, -3.0),
                SlopeChartPointResult(15000.0, -3.0),
                SlopeChartPointResult(15000.0, -6.0),
                SlopeChartPointResult(16000.0, -6.0),
                SlopeChartPointResult(16000.0, -3.0),
                SlopeChartPointResult(17000.0, -3.0),
                SlopeChartPointResult(17000.0, 0.0),
                SlopeChartPointResult(25000.0, 0.0)
            ),
            response.slopes
        )
    }

    @Test
    @Throws(IOException::class)
    fun testSlopeGraphStopToStart() {
        val waypointStart = PathfindingWaypoint("TD0", 25000.0, EdgeDirection.STOP_TO_START)
        val waypointEnd = PathfindingWaypoint("TD0", 0.0, EdgeDirection.STOP_TO_START)
        val waypointsStart = makeBidirectionalEndPoint(waypointStart)
        val waypointsEnd = makeBidirectionalEndPoint(waypointEnd)
        val waypoints: Array<Array<PathfindingWaypoint>> = Array(2) { waypointsStart }
        waypoints[1] = waypointsEnd
        val requestBody =
            PathfindingRequest.adapter.toJson(
                PathfindingRequest(waypoints, "small_infra/infra.json", "1", listOf(), null)
            )
        val result =
            TakesUtils.readBodyResponse(
                PathfindingBlocksEndpoint(infraManager)
                    .act(RqFake("POST", "/pathfinding/routes", requestBody))
            )
        val response = PathfindingResult.adapterResult.fromJson(result)!!
        Assertions.assertIterableEquals(
            listOf(
                SlopeChartPointResult(0.0, 0.0),
                SlopeChartPointResult(8000.0, 0.0),
                SlopeChartPointResult(8000.0, 3.0),
                SlopeChartPointResult(9000.0, 3.0),
                SlopeChartPointResult(9000.0, 6.0),
                SlopeChartPointResult(10000.0, 6.0),
                SlopeChartPointResult(10000.0, 3.0),
                SlopeChartPointResult(11000.0, 3.0),
                SlopeChartPointResult(11000.0, 0.0),
                SlopeChartPointResult(16000.0, 0.0),
                SlopeChartPointResult(16000.0, -3.0),
                SlopeChartPointResult(17000.0, -3.0),
                SlopeChartPointResult(17000.0, -6.0),
                SlopeChartPointResult(18000.0, -6.0),
                SlopeChartPointResult(18000.0, -3.0),
                SlopeChartPointResult(19000.0, -3.0),
                SlopeChartPointResult(19000.0, 0.0),
                SlopeChartPointResult(25000.0, 0.0)
            ),
            response.slopes
        )
    }

    @Test
    fun pathStartingAtTrackEdge() {
        /*
        foo_a   foo_to_bar   bar_a
        ------>|----------->|------>
              ^             ^
           new_op_1      new_op_2
         */
        val waypointStart =
            PathfindingWaypoint("ne.micro.foo_a", 200.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("ne.micro.bar_a", 0.0, EdgeDirection.START_TO_STOP)
        val waypoints = Array(2) { Array(1) { waypointStart } }
        waypoints[1][0] = waypointEnd
        val rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json")
        rjsInfra.operationalPoints.add(
            RJSOperationalPoint(
                "new_op_1",
                listOf(RJSOperationalPointPart("ne.micro.foo_a", 200.0, null)),
                null,
                null
            )
        )
        rjsInfra.operationalPoints.add(
            RJSOperationalPoint(
                "new_op_2",
                listOf(RJSOperationalPointPart("ne.micro.bar_a", 0.0, null)),
                null,
                null
            )
        )
        val infra = Helpers.fullInfraFromRJS(rjsInfra)

        val path = runPathfinding(infra, waypoints, listOf(TestTrains.REALISTIC_FAST_TRAIN), null)
        val res =
            convertPathfindingResult(
                infra.blockInfra,
                infra.rawInfra,
                path,
                DiagnosticRecorderImpl(true)
            )
        validatePathfindingResult(path, res, infra.rawInfra, infra.blockInfra)
        assertEquals(
            listOf(
                PathWaypointResult(
                    PathWaypointLocation("ne.micro.foo_a", 200.0),
                    0.0,
                    false,
                    "new_op_1"
                ),
                PathWaypointResult(
                    PathWaypointLocation("ne.micro.bar_a", 0.0),
                    10_000.0,
                    false,
                    "new_op_2"
                ),
            ),
            res.pathWaypoints
        )
    }

    companion object {
        private const val SIGNALING_TYPE = "BAL3"

        private fun makeBidirectionalEndPoint(
            point: PathfindingWaypoint
        ): Array<PathfindingWaypoint> {
            val waypointInverted =
                PathfindingWaypoint(point.trackSection, point.offset, point.direction.opposite())
            return arrayOf(point, waypointInverted)
        }

        private fun expectWaypointInPathResult(
            result: PathfindingResult?,
            waypoint: PathfindingWaypoint
        ) {
            for (route in result!!.routePaths) {
                for (track in route.trackSections) {
                    if (track.trackSectionID != waypoint.trackSection) continue
                    val begin = min(track.getBegin(), track.getEnd())
                    val end = max(track.getBegin(), track.getEnd())
                    if (waypoint.offset in begin..end) return
                }
            }
            Assertions.fail<Any>("Expected path result to contain a location but not found")
        }

        @JvmStatic
        fun simpleRoutesSameEdgeArgs(): Stream<Arguments> {
            return Stream.of(
                Arguments.of(
                    true,
                    listOf(
                        RJSRoutePath(
                            "rt.buffer_stop_c->tde.track-bar",
                            listOf(
                                RJSDirectionalTrackRange(
                                    "ne.micro.bar_a",
                                    100.0,
                                    110.0,
                                    EdgeDirection.STOP_TO_START
                                )
                            ),
                            SIGNALING_TYPE
                        )
                    ),
                    listOf(
                        PathWaypointResult(
                            PathWaypointLocation("ne.micro.bar_a", 110.0),
                            0.0,
                            false,
                            null
                        ),
                        PathWaypointResult(
                            PathWaypointLocation("ne.micro.bar_a", 100.0),
                            10.0,
                            false,
                            "op.station_bar"
                        )
                    )
                ),
                Arguments.of(
                    false,
                    listOf(
                        RJSRoutePath(
                            "rt.tde.foo_a-switch_foo->buffer_stop_c",
                            listOf(
                                RJSDirectionalTrackRange(
                                    "ne.micro.bar_a",
                                    100.0,
                                    110.0,
                                    EdgeDirection.START_TO_STOP
                                )
                            ),
                            SIGNALING_TYPE
                        )
                    ),
                    listOf(
                        PathWaypointResult(
                            PathWaypointLocation("ne.micro.bar_a", 100.0),
                            0.0,
                            false,
                            "op.station_bar"
                        ),
                        PathWaypointResult(
                            PathWaypointLocation("ne.micro.bar_a", 110.0),
                            10.0,
                            false,
                            null
                        )
                    )
                )
            )
        }

        @JvmStatic
        fun provideInfraParameters(): Stream<Arguments> {
            val res = HashSet<Arguments>()
            val infraPaths = ArrayList(listOf("tiny_infra", "one_line", "three_trains"))
            for (inverted in booleanArrayOf(true, false)) for (path in infraPaths) res.add(
                Arguments.of(path, inverted)
            )
            return res.stream()
        }

        /**
         * Generates a pathfinding request from infra + simulation files. The requested path follows
         * the path of a train.
         */
        @Throws(Exception::class)
        private fun requestFromExampleInfra(
            infraPath: String,
            simPath: String,
            inverted: Boolean
        ): PathfindingRequest {
            val simulation =
                MoshiUtils.deserialize(
                    StandaloneSimulationCommand.Input.adapter,
                    Helpers.getResourcePath("infras/" + simPath)
                )
            val scheduleGroup = simulation.trainScheduleGroups[0]
            val waypoints: Array<Array<PathfindingWaypoint>> =
                Array(2) { Array(2) { scheduleGroup.waypoints[0][0] } }
            val startIndex = if (inverted) 1 else 0
            val endIndex = if (inverted) 0 else 1
            waypoints[startIndex] = scheduleGroup.waypoints[0]
            waypoints[endIndex] = scheduleGroup.waypoints[scheduleGroup.waypoints.size - 1]
            return PathfindingRequest(waypoints, infraPath, "", listOf(), null)
        }
    }
    */
}
