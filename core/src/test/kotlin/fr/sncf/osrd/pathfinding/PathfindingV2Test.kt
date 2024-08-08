package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.api.api_v2.TrackLocation
import fr.sncf.osrd.api.api_v2.TrackRange
import fr.sncf.osrd.api.api_v2.pathfinding.*
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.utils.takes.TakesUtils
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import org.assertj.core.api.AssertionsForClassTypes
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.takes.rq.RqFake

class PathfindingV2Test : ApiTest() {
    @Test
    fun simpleTinyInfraTest() {
        val waypointStart = TrackLocation("ne.micro.foo_b", Offset(50.meters))
        val waypointEnd = TrackLocation("ne.micro.bar_a", Offset(100.meters))
        val waypointsStart = listOf(waypointStart)
        val waypointsEnd = listOf(waypointEnd)
        val waypoints = listOf(waypointsStart, waypointsEnd)
        val requestBody =
            pathfindingRequestAdapter.toJson(
                PathfindingBlockRequest(
                    rollingStockLoadingGauge = RJSLoadingGaugeType.G1,
                    rollingStockIsThermal = true,
                    rollingStockSupportedElectrifications = listOf(),
                    rollingStockSupportedSignalingSystems = listOf("BAL"),
                    timeout = null,
                    infra = "tiny_infra/infra.json",
                    expectedVersion = "1",
                    pathItems = waypoints,
                )
            )
        val rawResponse =
            PathfindingBlocksEndpointV2(infraManager)
                .act(RqFake("POST", "/v2/pathfinding/blocks", requestBody))
        val response = TakesUtils.readBodyResponse(rawResponse)
        val parsed = (pathfindingResponseAdapter.fromJson(response) as? PathfindingBlockSuccess)!!
        AssertionsForClassTypes.assertThat(parsed.length.distance).isEqualTo(10250.meters)
        assertEquals(2, parsed.pathItemPositions.size)
        assertEquals(0.meters, parsed.pathItemPositions[0].distance)
        assertEquals(parsed.length.distance, parsed.pathItemPositions[1].distance)
        assertEquals(3, parsed.blocks.size)
        assertEquals(2, parsed.routes.size)
        assertEquals(
            listOf(
                TrackRange(
                    "ne.micro.foo_b",
                    Offset(50.meters),
                    Offset(200.meters),
                    EdgeDirection.START_TO_STOP
                ),
                TrackRange(
                    "ne.micro.foo_to_bar",
                    Offset(0.meters),
                    Offset(10_000.meters),
                    EdgeDirection.START_TO_STOP
                ),
                TrackRange(
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
        val requestBody =
            pathfindingRequestAdapter.toJson(
                PathfindingBlockRequest(
                    rollingStockLoadingGauge = RJSLoadingGaugeType.G1,
                    rollingStockIsThermal = false,
                    rollingStockSupportedElectrifications = listOf("nonexistent_electrification"),
                    rollingStockSupportedSignalingSystems = listOf("BAL"),
                    timeout = null,
                    infra = "tiny_infra/infra.json",
                    expectedVersion = "1",
                    pathItems = waypoints,
                )
            )
        val rawResponse =
            PathfindingBlocksEndpointV2(infraManager)
                .act(RqFake("POST", "/v2/pathfinding/blocks", requestBody))
        val response = TakesUtils.readBodyResponse(rawResponse)
        (pathfindingResponseAdapter.fromJson(response) as? IncompatibleElectrification)!!
    }

    //    @Test
    //    @Throws(Exception::class)
    //    fun incompatibleLoadingGaugeTest() {
    //        val waypointStart =
    //            PathfindingWaypoint("ne.micro.foo_b", 100.0, EdgeDirection.START_TO_STOP)
    //        val waypointEnd = PathfindingWaypoint("ne.micro.bar_a", 100.0,
    // EdgeDirection.START_TO_STOP)
    //        val waypoints = Array(2) { Array(1) { waypointStart } }
    //        waypoints[1][0] = waypointEnd
    //        val rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json")
    //        for (track in rjsInfra.trackSections) if (track.getID() == "ne.micro.foo_to_bar")
    //            track.loadingGaugeLimits =
    //                listOf(RJSLoadingGaugeLimit(1000.0, 2000.0, RJSLoadingGaugeType.G1))
    //        val infra = Helpers.fullInfraFromRJS(rjsInfra)
    //
    //        // Check that we can go through the infra with a small train
    //        assertThat(runPathfinding(infra, waypoints, listOf(TestTrains.REALISTIC_FAST_TRAIN),
    // null))
    //            .isNotNull()
    //
    //        // Check that we can't go through the infra with a large train
    //        AssertionsForClassTypes.assertThatThrownBy {
    //            runPathfinding(infra, waypoints, listOf(TestTrains.FAST_TRAIN_LARGE_GAUGE), null)
    //        }
    //            .isExactlyInstanceOf(OSRDError::class.java)
    //            .satisfies({ exception ->
    //                AssertionsForClassTypes.assertThat((exception as OSRDError?)!!.osrdErrorType)
    //                    .isEqualTo(ErrorType.PathfindingGaugeError)
    //                AssertionsForClassTypes.assertThat(exception.context)
    //                    .isEqualTo(mapOf<String, Any>())
    //            })
    //
    //        // Check that we can go until right before the blocked section with a large train
    //        waypoints[1][0] =
    //            PathfindingWaypoint("ne.micro.foo_to_bar", 999.0, EdgeDirection.START_TO_STOP)
    //        assertThat(
    //            runPathfinding(infra, waypoints, listOf(TestTrains.FAST_TRAIN_LARGE_GAUGE), null)
    //        )
    //            .isNotNull()
    //    }

    @Test
    @DisplayName("If no path exists, throws a generic error message")
    @Throws(Exception::class)
    fun noPathTest() {
        val waypointStart = TrackLocation("ne.micro.foo_b", Offset(12.meters))
        val waypointEnd = TrackLocation("ne.micro.foo_b", Offset(13.meters))
        val waypointsStart = listOf(waypointStart)
        val waypointsEnd = listOf(waypointEnd)
        val waypoints = listOf(waypointsStart, waypointsEnd)
        val requestBody =
            pathfindingRequestAdapter.toJson(
                PathfindingBlockRequest(
                    rollingStockLoadingGauge = RJSLoadingGaugeType.G1,
                    rollingStockIsThermal = false,
                    rollingStockSupportedElectrifications = listOf("nonexistent_electrification"),
                    rollingStockSupportedSignalingSystems = listOf("BAL"),
                    timeout = null,
                    infra = "tiny_infra/infra.json",
                    expectedVersion = "1",
                    pathItems = waypoints,
                )
            )
        val rawResponse =
            PathfindingBlocksEndpointV2(infraManager)
                .act(RqFake("POST", "/v2/pathfinding/blocks", requestBody))
        val response = TakesUtils.readBodyResponse(rawResponse)
    }

    //    @Test
    //    @Throws(IOException::class)
    //    fun missingTrackTest() {
    //        val waypoint =
    //            PathfindingWaypoint("this_track_does_not_exist", 0.0, EdgeDirection.STOP_TO_START)
    //        val waypoints = Array(2) { Array(1) { waypoint } }
    //        val requestBody =
    //            PathfindingRequest.adapter.toJson(
    //                PathfindingRequest(waypoints, "tiny_infra/infra.json", "1", listOf(), null)
    //            )
    //        val response =
    //            Path(infraManager)
    //                .act(RqFake("POST", "/pathfinding/routes", requestBody))
    //        val res = TakesUtils.readHeadResponse(response)
    //        AssertionsForClassTypes.assertThat(res[0]).contains("400")
    //        val infra = Helpers.tinyInfra
    //        AssertionsForClassTypes.assertThatThrownBy {
    //            runPathfinding(infra, waypoints, listOf(), null)
    //        }
    //            .isExactlyInstanceOf(OSRDError::class.java)
    //            .satisfies({ exception ->
    //                AssertionsForClassTypes.assertThat((exception as OSRDError?)!!.osrdErrorType)
    //                    .isEqualTo(ErrorType.UnknownTrackSection)
    //                AssertionsForClassTypes.assertThat(exception.context)
    //                    .isEqualTo(mapOf(Pair("track_section_id", "this_track_does_not_exist")))
    //            })
    //    }
}
