package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.api.api_v2.DirectionalTrackRange
import fr.sncf.osrd.api.api_v2.RangeValues

import fr.sncf.osrd.api.api_v2.path_properties.*
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.utils.takes.TakesUtils
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import org.junit.jupiter.api.Test
import org.takes.rq.RqFake

class PathPropEndpointTest : ApiTest() {

    @Test
    fun simpleSmallInfraTest() {
        val trackSectionRanges =
            listOf(
                DirectionalTrackRange(
                    "TA0",
                    Offset(50.meters),
                    Offset(2000.meters),
                    EdgeDirection.START_TO_STOP
                ),
                DirectionalTrackRange(
                    "TA1",
                    Offset(0.meters),
                    Offset(1950.meters),
                    EdgeDirection.START_TO_STOP
                )
            )
        val requestBody =
            pathPropRequestAdapter.toJson(
                PathPropRequest(
                    trackSectionRanges = trackSectionRanges,
                    infra = "small_infra/infra.json",
                    expectedVersion = "1"
                )
            )
        val rawResponse =
            PathPropEndpoint(infraManager).act(RqFake("POST", "v2/path_properties", requestBody))
        val response = TakesUtils.readBodyResponse(rawResponse)
        val parsed = pathPropResponseAdapter.fromJson(response)!!

        assertNotNull(parsed)
        assertEquals(parsed.slopes, RangeValues(listOf(), listOf(0.0)))
        assertEquals(parsed.curves, RangeValues(listOf(), listOf(0.0)))
        assertEquals(
            parsed.electrifications,
            RangeValues(
                listOf(Offset(1910.meters), Offset(1950.meters)),
                listOf(Electrified("1500V"), Neutral(true), Electrified("25000V"))
            )
        )
        assertEquals(parsed.geometry.coordinates.size, 6)
        val oPs =
            listOf(
                OperationalPointResponse(
                    "West_station",
                    OperationalPointPartResponse("TA0", 700.0, null),
                    OperationalPointExtensions(
                        OperationalPointSncfExtension(0, "BV", "BV", "0", "WS"),
                        OperationalPointIdentifierExtension("West_station", 2)
                    ),
                    Offset(650.meters)
                ),
                OperationalPointResponse(
                    "West_station",
                    OperationalPointPartResponse("TA1", 500.0, null),
                    OperationalPointExtensions(
                        OperationalPointSncfExtension(0, "BV", "BV", "0", "WS"),
                        OperationalPointIdentifierExtension("West_station", 2)
                    ),
                    Offset(2450.meters)
                )
            )
        assertEquals(parsed.operationalPoints, oPs)
    }
}
