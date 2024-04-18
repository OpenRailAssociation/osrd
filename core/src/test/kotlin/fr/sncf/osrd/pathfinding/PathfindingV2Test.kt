package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.api.api_v2.TrackRange
import fr.sncf.osrd.api.api_v2.pathfinding.*
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.utils.takes.TakesUtils
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import org.assertj.core.api.AssertionsForClassTypes
import org.junit.jupiter.api.Test
import org.takes.rq.RqFake

class PathfindingV2Test : ApiTest() {
    @Test
    fun simpleTinyInfraTest() {
        val waypointStart =
            PathfindingBlockRequest.TrackLocation("ne.micro.foo_b", Offset(50.meters))
        val waypointEnd =
            PathfindingBlockRequest.TrackLocation("ne.micro.bar_a", Offset(100.meters))
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
        val waypointStart =
            PathfindingBlockRequest.TrackLocation("ne.micro.foo_b", Offset(50.meters))
        val waypointEnd =
            PathfindingBlockRequest.TrackLocation("ne.micro.bar_a", Offset(100.meters))
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
        val parsed =
            (pathfindingResponseAdapter.fromJson(response) as? IncompatibleElectrification)!!
    }
}
