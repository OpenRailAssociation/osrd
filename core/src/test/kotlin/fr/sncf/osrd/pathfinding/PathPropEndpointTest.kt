package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.api.DirectionalTrackRange
import fr.sncf.osrd.api.RangeValues
import fr.sncf.osrd.api.path_properties.*
import fr.sncf.osrd.cli.RqFake
import fr.sncf.osrd.geom.Point
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import org.junit.jupiter.api.Test

class PathPropEndpointTest : ApiTest() {

    @Test
    fun simpleSmallInfraTest() {
        val trackSectionRanges =
            listOf(
                DirectionalTrackRange(
                    "TA0",
                    Offset(50.meters),
                    Offset(2000.meters),
                    EdgeDirection.START_TO_STOP,
                ),
                DirectionalTrackRange(
                    "TA1",
                    Offset(0.meters),
                    Offset(1950.meters),
                    EdgeDirection.START_TO_STOP,
                ),
            )
        val requestBody =
            pathPropRequestAdapter.toJson(
                PathPropRequest(
                    trackSectionRanges = trackSectionRanges,
                    infra = "small_infra/infra.json",
                    expectedVersion = 1,
                )
            )
        val response = PathPropEndpoint(infraManager).act(RqFake(requestBody))
        val parsed = pathPropResponseAdapter.fromJson(response.body())!!

        assertNotNull(parsed)
        assertEquals(parsed.slopes, RangeValues(listOf(), listOf(0.0)))
        assertEquals(parsed.curves, RangeValues(listOf(), listOf(0.0)))
        assertEquals(
            parsed.electrifications,
            RangeValues(
                listOf(Offset(1910.meters), Offset(1950.meters)),
                listOf(Electrified("1500V"), Neutral(true), Electrified("25000V")),
            ),
        )
        // The size might change, there can be repeated points
        assertEquals(parsed.geometry.coordinates.size, 7)
        val oPs =
            listOf(
                OperationalPointResponse(
                    "West_station",
                    OperationalPointPartResponse("TA0", 700.0, "V1", null),
                    Offset(650.meters),
                    null,
                    "West_station",
                    8722,
                    null,
                    "FR",
                    "WS",
                    "BV",
                    true,
                    "0",
                ),
                OperationalPointResponse(
                    "West_station",
                    OperationalPointPartResponse("TA1", 500.0, "V2", null),
                    Offset(2450.meters),
                    null,
                    "West_station",
                    8722,
                    null,
                    "FR",
                    "WS",
                    "BV",
                    true,
                    "0",
                ),
            )
        assertEquals(parsed.operationalPoints, oPs)
        // Check topological distance to geometric distance projection
        val trackTA0GeoLength = Point(49.5, -0.4).distanceAsMeters(Point(49.5, -0.365)) * 1000
        val trackTA1GeoLength = Point(49.4999, -0.4).distanceAsMeters(Point(49.4999, -0.37)) * 1000
        val firstTrackRangeProportion = 1950.0 / 2000.0
        val firstTrackRangeLength = (firstTrackRangeProportion * trackTA0GeoLength).toLong()
        val secondTrackRangeLength = trackTA1GeoLength.toLong()
        // The repetition of the last two values is because of a null-length range
        // on the TA3 track section
        val geomProjection =
            GeometricProjection(
                listOf(
                    Offset.zero(),
                    Offset(1_950.meters),
                    Offset(3_900.meters),
                    Offset(3_900.meters),
                ),
                listOf(
                    Offset.zero(),
                    Offset(Distance(firstTrackRangeLength)),
                    Offset(Distance(firstTrackRangeLength + secondTrackRangeLength)),
                    Offset(Distance(firstTrackRangeLength + secondTrackRangeLength)),
                ),
            )
        assertEquals(geomProjection, parsed.geomProjection)
    }

    @Test
    fun testCurveGraph() {
        val trackSectionRanges =
            listOf(
                DirectionalTrackRange(
                    "TF1",
                    Offset(0.meters),
                    Offset(6_500.meters),
                    EdgeDirection.START_TO_STOP,
                )
            )
        val requestBody =
            pathPropRequestAdapter.toJson(
                PathPropRequest(
                    trackSectionRanges = trackSectionRanges,
                    infra = "small_infra/infra.json",
                    expectedVersion = 1,
                )
            )
        val response = PathPropEndpoint(infraManager).act(RqFake(requestBody))
        val parsed = pathPropResponseAdapter.fromJson(response.body())!!

        assertNotNull(parsed)
        assertEquals(
            parsed.curves,
            RangeValues(
                listOf(Offset(3_100.meters), Offset(4_400.meters)),
                listOf(0.0, 9_500.0, 0.0),
            ),
        )
    }

    @Test
    fun testInvertedCurveGraph() {
        val trackSectionRanges =
            listOf(
                DirectionalTrackRange(
                    "TF1",
                    Offset(0.meters),
                    Offset(6_500.meters),
                    EdgeDirection.STOP_TO_START,
                )
            )
        val requestBody =
            pathPropRequestAdapter.toJson(
                PathPropRequest(
                    trackSectionRanges = trackSectionRanges,
                    infra = "small_infra/infra.json",
                    expectedVersion = 1,
                )
            )
        val response = PathPropEndpoint(infraManager).act(RqFake(requestBody))
        val parsed = pathPropResponseAdapter.fromJson(response.body())!!

        assertNotNull(parsed)
        assertEquals(
            parsed.curves,
            RangeValues(
                listOf(Offset(2_100.meters), Offset(3_400.meters)),
                listOf(0.0, -9_500.0, 0.0),
            ),
        )
    }

    @Test
    fun testSlopeGraph() {
        val trackSectionRanges =
            listOf(
                DirectionalTrackRange(
                    "TD0",
                    Offset(1_000.meters),
                    Offset(23_000.meters),
                    EdgeDirection.START_TO_STOP,
                )
            )
        val requestBody =
            pathPropRequestAdapter.toJson(
                PathPropRequest(
                    trackSectionRanges = trackSectionRanges,
                    infra = "small_infra/infra.json",
                    expectedVersion = 1,
                )
            )
        val response = PathPropEndpoint(infraManager).act(RqFake(requestBody))
        val parsed = pathPropResponseAdapter.fromJson(response.body())!!

        assertNotNull(parsed)
        assertEquals(
            parsed.slopes,
            RangeValues(
                listOf(
                    Offset(5_000.meters),
                    Offset(6_000.meters),
                    Offset(7_000.meters),
                    Offset(8_000.meters),
                    Offset(13_000.meters),
                    Offset(14_000.meters),
                    Offset(15_000.meters),
                    Offset(16_000.meters),
                ),
                listOf(0.0, 3.0, 6.0, 3.0, 0.0, -3.0, -6.0, -3.0, 0.0),
            ),
        )
    }

    @Test
    fun testInvertedSlopeGraph() {
        val trackSectionRanges =
            listOf(
                DirectionalTrackRange(
                    "TD0",
                    Offset(1_000.meters),
                    Offset(23_000.meters),
                    EdgeDirection.STOP_TO_START,
                )
            )
        val requestBody =
            pathPropRequestAdapter.toJson(
                PathPropRequest(
                    trackSectionRanges = trackSectionRanges,
                    infra = "small_infra/infra.json",
                    expectedVersion = 1,
                )
            )
        val response = PathPropEndpoint(infraManager).act(RqFake(requestBody))
        val parsed = pathPropResponseAdapter.fromJson(response.body())!!

        assertNotNull(parsed)
        assertEquals(
            parsed.slopes,
            RangeValues(
                listOf(
                    Offset(6_000.meters),
                    Offset(7_000.meters),
                    Offset(8_000.meters),
                    Offset(9_000.meters),
                    Offset(14_000.meters),
                    Offset(15_000.meters),
                    Offset(16_000.meters),
                    Offset(17_000.meters),
                ),
                listOf(0.0, 3.0, 6.0, 3.0, 0.0, -3.0, -6.0, -3.0, 0.0),
            ),
        )
    }
}
