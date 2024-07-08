package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.api.api_v2.TrackLocation
import fr.sncf.osrd.api.api_v2.TrackRange
import fr.sncf.osrd.api.api_v2.pathfinding.IncompatibleConstraints
import fr.sncf.osrd.api.api_v2.pathfinding.IncompatibleConstraintsPathResponse
import fr.sncf.osrd.api.api_v2.pathfinding.PathfindingBlockRequest
import fr.sncf.osrd.api.api_v2.pathfinding.PathfindingBlockSuccess
import fr.sncf.osrd.api.api_v2.pathfinding.PathfindingBlocksEndpointV2
import fr.sncf.osrd.api.api_v2.pathfinding.RangeValue
import fr.sncf.osrd.api.api_v2.pathfinding.pathfindingRequestAdapter
import fr.sncf.osrd.api.api_v2.pathfinding.pathfindingResponseAdapter
import fr.sncf.osrd.graph.Pathfinding
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

        val unconstrainedRequestBody =
            pathfindingRequestAdapter.toJson(
                PathfindingBlockRequest(
                    rollingStockLoadingGauge = RJSLoadingGaugeType.GC,
                    rollingStockIsThermal = true,
                    rollingStockSupportedElectrifications = listOf(),
                    rollingStockSupportedSignalingSystems =
                        listOf("BAL", "BAPR", "TVM300", "TVM430"),
                    timeout = null,
                    infra = "tiny_infra/infra.json",
                    expectedVersion = "1",
                    pathItems = waypoints,
                )
            )
        val unconstrainedRawResponse =
            PathfindingBlocksEndpointV2(infraManager)
                .act(RqFake("POST", "/v2/pathfinding/blocks", unconstrainedRequestBody))
        val unconstrainedResponse = TakesUtils.readBodyResponse(unconstrainedRawResponse)
        val unconstrainedParsed =
            (pathfindingResponseAdapter.fromJson(unconstrainedResponse)
                as? PathfindingBlockSuccess)!!

        val requestBody =
            pathfindingRequestAdapter.toJson(
                PathfindingBlockRequest(
                    rollingStockLoadingGauge = RJSLoadingGaugeType.G1,
                    rollingStockIsThermal = false,
                    rollingStockSupportedElectrifications = listOf("nonexistent_electrification"),
                    rollingStockSupportedSignalingSystems = listOf("TVM300"),
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
                    incompatibleSignalingSystemRanges =
                        listOf(
                            RangeValue(
                                Pathfinding.Range(Offset.zero(), Offset(10250.meters)),
                                "BAL"
                            )
                        )
                )
        )
    }
}
