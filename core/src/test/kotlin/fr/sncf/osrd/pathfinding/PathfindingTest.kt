package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.api.pathfinding.PathfindingBlocksEndpoint
import fr.sncf.osrd.api.pathfinding.convertPathfindingResult
import fr.sncf.osrd.api.pathfinding.request.PathfindingRequest
import fr.sncf.osrd.api.pathfinding.request.PathfindingWaypoint
import fr.sncf.osrd.api.pathfinding.response.CurveChartPointResult
import fr.sncf.osrd.api.pathfinding.response.PathWaypointResult
import fr.sncf.osrd.api.pathfinding.response.PathWaypointResult.PathWaypointLocation
import fr.sncf.osrd.api.pathfinding.response.PathfindingResult
import fr.sncf.osrd.api.pathfinding.response.SlopeChartPointResult
import fr.sncf.osrd.api.pathfinding.runPathfinding
import fr.sncf.osrd.api.pathfinding.validatePathfindingResult
import fr.sncf.osrd.cli.StandaloneSimulationCommand
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.infra.RJSOperationalPoint
import fr.sncf.osrd.railjson.schema.infra.RJSRoutePath
import fr.sncf.osrd.railjson.schema.infra.RJSTrackSection
import fr.sncf.osrd.railjson.schema.infra.trackranges.*
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorderImpl
import fr.sncf.osrd.train.TestTrains
import fr.sncf.osrd.utils.Helpers
import fr.sncf.osrd.utils.moshi.MoshiUtils
import fr.sncf.osrd.utils.takes.TakesUtils
import java.io.IOException
import java.net.URISyntaxException
import java.util.*
import java.util.stream.Collectors
import java.util.stream.Stream
import kotlin.math.max
import kotlin.math.min
import kotlin.test.assertEquals
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.AssertionsForClassTypes
import org.junit.jupiter.api.Assertions
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestInstance
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource
import org.takes.rq.RqFake

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PathfindingTest : ApiTest() {
    @Test
    fun simpleRoutes() {
        val waypointStart = PathfindingWaypoint("ne.micro.foo_b", 50.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("ne.micro.bar_a", 100.0, EdgeDirection.START_TO_STOP)
        val waypointsStart = makeBidirectionalEndPoint(waypointStart)
        val waypointsEnd = makeBidirectionalEndPoint(waypointEnd)
        val waypoints: Array<Array<PathfindingWaypoint>> = Array(2) { waypointsStart }
        waypoints[1] = waypointsEnd
        val requestBody =
            PathfindingRequest.adapter.toJson(
                PathfindingRequest(waypoints, "tiny_infra/infra.json", "1", listOf(), null)
            )
        val result =
            TakesUtils.readBodyResponse(
                PathfindingBlocksEndpoint(infraManager)
                    .act(RqFake("POST", "/pathfinding/routes", requestBody))
            )
        val response = PathfindingResult.adapterResult.fromJson(result)!!
        AssertionsForClassTypes.assertThat(response.length).isEqualTo(10250.0)
        val expectedRoutePaths =
            listOf(
                RJSRoutePath(
                    "rt.buffer_stop_b->tde.foo_b-switch_foo",
                    listOf(
                        RJSDirectionalTrackRange(
                            "ne.micro.foo_b",
                            50.0,
                            175.0,
                            EdgeDirection.START_TO_STOP
                        )
                    ),
                    SIGNALING_TYPE
                ),
                RJSRoutePath(
                    "rt.tde.foo_b-switch_foo->buffer_stop_c",
                    listOf(
                        RJSDirectionalTrackRange(
                            "ne.micro.foo_b",
                            175.0,
                            200.0,
                            EdgeDirection.START_TO_STOP
                        ),
                        RJSDirectionalTrackRange(
                            "ne.micro.foo_to_bar",
                            0.0,
                            10000.0,
                            EdgeDirection.START_TO_STOP
                        ),
                        RJSDirectionalTrackRange(
                            "ne.micro.bar_a",
                            0.0,
                            100.0,
                            EdgeDirection.START_TO_STOP
                        )
                    ),
                    SIGNALING_TYPE
                )
            )
        AssertionsForClassTypes.assertThat(response.routePaths).isEqualTo(expectedRoutePaths)
        val expectedPathWaypoints =
            listOf(
                PathWaypointResult(PathWaypointLocation("ne.micro.foo_b", 50.0), 0.0, false, null),
                PathWaypointResult(
                    PathWaypointLocation("ne.micro.foo_b", 100.0),
                    50.0,
                    true,
                    "op.station_foo"
                ),
                PathWaypointResult(
                    PathWaypointLocation("ne.micro.bar_a", 100.0),
                    10250.0,
                    false,
                    "op.station_bar"
                )
            )
        AssertionsForClassTypes.assertThat(response.pathWaypoints).isEqualTo(expectedPathWaypoints)
    }

    @Test
    @Throws(Exception::class)
    fun testMiddleStop() {
        val waypointStart =
            PathfindingWaypoint("ne.micro.foo_b", 100.0, EdgeDirection.START_TO_STOP)
        val waypointMid =
            PathfindingWaypoint("ne.micro.foo_to_bar", 5000.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("ne.micro.bar_a", 100.0, EdgeDirection.START_TO_STOP)
        val waypoints: Array<Array<PathfindingWaypoint>> =
            Array(3) { makeBidirectionalEndPoint(waypointStart) }
        waypoints[1] = makeBidirectionalEndPoint(waypointMid)
        waypoints[2] = makeBidirectionalEndPoint(waypointEnd)
        val requestBody =
            PathfindingRequest.adapter.toJson(
                PathfindingRequest(waypoints, "tiny_infra/infra.json", "1", listOf(), null)
            )
        val result =
            TakesUtils.readBodyResponse(
                PathfindingBlocksEndpoint(infraManager)
                    .act(RqFake("POST", "/pathfinding/routes", requestBody))
            )
        val response = PathfindingResult.adapterResult.fromJson(result)!!
        AssertionsForClassTypes.assertThat(response.length).isEqualTo(10200.0)
        val expectedRoutePaths =
            listOf(
                RJSRoutePath(
                    "rt.buffer_stop_b->tde.foo_b-switch_foo",
                    listOf(
                        RJSDirectionalTrackRange(
                            "ne.micro.foo_b",
                            100.0,
                            175.0,
                            EdgeDirection.START_TO_STOP
                        )
                    ),
                    SIGNALING_TYPE
                ),
                RJSRoutePath(
                    "rt.tde.foo_b-switch_foo->buffer_stop_c",
                    listOf(
                        RJSDirectionalTrackRange(
                            "ne.micro.foo_b",
                            175.0,
                            200.0,
                            EdgeDirection.START_TO_STOP
                        ),
                        RJSDirectionalTrackRange(
                            "ne.micro.foo_to_bar",
                            0.0,
                            10000.0,
                            EdgeDirection.START_TO_STOP
                        ),
                        RJSDirectionalTrackRange(
                            "ne.micro.bar_a",
                            0.0,
                            100.0,
                            EdgeDirection.START_TO_STOP
                        )
                    ),
                    SIGNALING_TYPE
                )
            )
        AssertionsForClassTypes.assertThat(response.routePaths).isEqualTo(expectedRoutePaths)
        val expectedPathWaypoints =
            listOf(
                PathWaypointResult(
                    PathWaypointLocation("ne.micro.foo_b", 100.0),
                    0.0,
                    false,
                    "op.station_foo"
                ),
                PathWaypointResult(
                    PathWaypointLocation("ne.micro.foo_to_bar", 5000.0),
                    5100.0,
                    false,
                    null
                ),
                PathWaypointResult(
                    PathWaypointLocation("ne.micro.bar_a", 100.0),
                    10200.0,
                    false,
                    "op.station_bar"
                )
            )
        AssertionsForClassTypes.assertThat(response.pathWaypoints).isEqualTo(expectedPathWaypoints)
    }

    @Test
    @DisplayName("If no path exists, throws a generic error message")
    @Throws(Exception::class)
    fun noPathTest() {
        val waypointStart = PathfindingWaypoint("ne.micro.foo_b", 12.0, EdgeDirection.STOP_TO_START)
        val waypointEnd = PathfindingWaypoint("ne.micro.foo_b", 13.0, EdgeDirection.STOP_TO_START)
        val waypoints = Array(2) { Array(1) { waypointStart } }
        waypoints[1][0] = waypointEnd
        val requestBody =
            PathfindingRequest.adapter.toJson(
                PathfindingRequest(waypoints, "tiny_infra/infra.json", "1", listOf(), null)
            )
        val res =
            TakesUtils.readHeadResponse(
                PathfindingBlocksEndpoint(infraManager)
                    .act(RqFake("POST", "/pathfinding/routes", requestBody))
            )
        AssertionsForClassTypes.assertThat(res[0]).contains("400")
        val infra = Helpers.tinyInfra
        AssertionsForClassTypes.assertThatThrownBy {
                runPathfinding(infra, waypoints, listOf(), null)
            }
            .isExactlyInstanceOf(OSRDError::class.java)
            .satisfies({ exception ->
                AssertionsForClassTypes.assertThat((exception as OSRDError?)!!.osrdErrorType)
                    .isEqualTo(ErrorType.PathfindingGenericError)
                AssertionsForClassTypes.assertThat((exception as OSRDError?)!!.context)
                    .isEqualTo(HashMap<Any, Any>())
            })
    }

    @Test
    @Throws(IOException::class)
    fun missingTrackTest() {
        val waypoint =
            PathfindingWaypoint("this_track_does_not_exist", 0.0, EdgeDirection.STOP_TO_START)
        val waypoints = Array(2) { Array(1) { waypoint } }
        val requestBody =
            PathfindingRequest.adapter.toJson(
                PathfindingRequest(waypoints, "tiny_infra/infra.json", "1", listOf(), null)
            )
        val response =
            PathfindingBlocksEndpoint(infraManager)
                .act(RqFake("POST", "/pathfinding/routes", requestBody))
        val res = TakesUtils.readHeadResponse(response)
        AssertionsForClassTypes.assertThat(res[0]).contains("400")
        val infra = Helpers.tinyInfra
        AssertionsForClassTypes.assertThatThrownBy {
                runPathfinding(infra, waypoints, listOf(), null)
            }
            .isExactlyInstanceOf(OSRDError::class.java)
            .satisfies({ exception ->
                AssertionsForClassTypes.assertThat((exception as OSRDError?)!!.osrdErrorType)
                    .isEqualTo(ErrorType.UnknownTrackSection)
                AssertionsForClassTypes.assertThat((exception as OSRDError?)!!.context)
                    .isEqualTo(mapOf(Pair("track_section_id", "this_track_does_not_exist")))
            })
    }

    @Test
    @Throws(Exception::class)
    fun incompatibleLoadingGaugeTest() {
        val waypointStart =
            PathfindingWaypoint("ne.micro.foo_b", 100.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("ne.micro.bar_a", 100.0, EdgeDirection.START_TO_STOP)
        val waypoints = Array(2) { Array(1) { waypointStart } }
        waypoints[1][0] = waypointEnd
        val rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json")
        for (track in rjsInfra.trackSections) if (track.getID() == "ne.micro.foo_to_bar")
            track.loadingGaugeLimits =
                listOf(RJSLoadingGaugeLimit(1000.0, 2000.0, RJSLoadingGaugeType.G1))
        val infra = Helpers.fullInfraFromRJS(rjsInfra)

        // Check that we can go through the infra with a small train
        assertThat(runPathfinding(infra, waypoints, listOf(TestTrains.REALISTIC_FAST_TRAIN), null))
            .isNotNull()

        // Check that we can't go through the infra with a large train
        AssertionsForClassTypes.assertThatThrownBy {
                runPathfinding(infra, waypoints, listOf(TestTrains.FAST_TRAIN_LARGE_GAUGE), null)
            }
            .isExactlyInstanceOf(OSRDError::class.java)
            .satisfies({ exception ->
                AssertionsForClassTypes.assertThat((exception as OSRDError?)!!.osrdErrorType)
                    .isEqualTo(ErrorType.PathfindingGaugeError)
                AssertionsForClassTypes.assertThat((exception as OSRDError?)!!.context)
                    .isEqualTo(mapOf<String, Any>())
            })

        // Check that we can go until right before the blocked section with a large train
        waypoints[1][0] =
            PathfindingWaypoint("ne.micro.foo_to_bar", 999.0, EdgeDirection.START_TO_STOP)
        assertThat(
                runPathfinding(infra, waypoints, listOf(TestTrains.FAST_TRAIN_LARGE_GAUGE), null)
            )
            .isNotNull()
    }

    @Test
    @Throws(Exception::class)
    fun differentPathsDueToElectrificationConstraints() {
        val waypointStart = PathfindingWaypoint("TA1", 1550.0, EdgeDirection.START_TO_STOP)
        val waypointEnd = PathfindingWaypoint("TH0", 103.0, EdgeDirection.START_TO_STOP)
        val waypoints = Array(2) { Array(1) { waypointStart } }
        waypoints[1][0] = waypointEnd
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")

        // Run a pathfinding with a non-electric train
        val infra = Helpers.fullInfraFromRJS(rjsInfra)
        val normalPath =
            runPathfinding(infra, waypoints, listOf(TestTrains.REALISTIC_FAST_TRAIN), null)

        // Replace with custom electrifications
        // Set voltage to 25000V everywhere except for trackSectionToBlock
        val trackSectionToBlock =
            normalPath.ranges
                .map { range -> range.edge }
                .flatMap { block ->
                    infra.blockInfra.getTrackChunksFromBlock(block).map { dirChunk ->
                        infra.rawInfra.getTrackSectionName(
                            infra.rawInfra.getTrackFromChunk(dirChunk.value)
                        )
                    }
                }
                .first { trackName -> trackName.startsWith("TD") }
        val voltageTrackRanges =
            rjsInfra.trackSections
                .stream()
                .filter { rjsTrackSection: RJSTrackSection ->
                    rjsTrackSection.id != trackSectionToBlock
                }
                .map { rjsTrackSection: RJSTrackSection ->
                    RJSApplicableDirectionsTrackRange(
                        rjsTrackSection.id,
                        ApplicableDirection.BOTH,
                        0.0,
                        rjsTrackSection.length
                    )
                }
                .collect(Collectors.toList())
        val voltageElectrification = RJSElectrification("25000V", voltageTrackRanges)
        val noVoltageElectrification =
            RJSElectrification(
                "",
                listOf(
                    RJSApplicableDirectionsTrackRange(
                        trackSectionToBlock,
                        ApplicableDirection.BOTH,
                        0.0,
                        rjsInfra.trackSections
                            .stream()
                            .filter { rjsTrackSection: RJSTrackSection ->
                                rjsTrackSection.id == trackSectionToBlock
                            }
                            .findFirst()
                            .get()
                            .length
                    )
                )
            )
        rjsInfra.electrifications =
            ArrayList(listOf(voltageElectrification, noVoltageElectrification))
        val infraWithNonElectrifiedTrack = Helpers.fullInfraFromRJS(rjsInfra)

        // Run another pathfinding with an electric train
        val electricPath =
            runPathfinding(
                infraWithNonElectrifiedTrack,
                waypoints,
                listOf(TestTrains.FAST_ELECTRIC_TRAIN),
                null
            )

        // Check that the paths are different, we need to avoid the non-electrified track
        assertThat(normalPath).isNotNull()
        assertThat(electricPath).isNotNull()
        assertThat(normalPath).usingRecursiveComparison().isNotEqualTo(electricPath)
    }

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
                null
            )
        )
        rjsInfra.operationalPoints.add(
            RJSOperationalPoint(
                "new_op_2",
                listOf(RJSOperationalPointPart("ne.micro.bar_a", 0.0, null)),
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
}
