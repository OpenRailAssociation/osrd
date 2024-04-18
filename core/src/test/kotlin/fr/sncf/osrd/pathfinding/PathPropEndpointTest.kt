package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.api.ApiTest
import fr.sncf.osrd.api.api_v2.TrackRange
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
                TrackRange(
                    "TG0",
                    Offset(50.meters),
                    Offset(1000.meters),
                    EdgeDirection.START_TO_STOP
                ),
                TrackRange(
                    "TG1",
                    Offset(0.meters),
                    Offset(4000.meters),
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
        val parsed = pathPropResultAdapter.fromJson(response)!!

        assertNotNull(parsed)
        assertEquals(parsed.slopes, RangeValues(listOf(), listOf(0.0)))
        assertEquals(parsed.gradients, RangeValues(listOf(), listOf(0.0)))
        assertEquals(
            parsed.electrifications,
            RangeValues(listOf(4450.meters), listOf(Electrified("25000V"), Neutral(true)))
        )
        assertEquals(parsed.geometry.coordinates.size, 14)
        assertEquals(parsed.operationalPoints.size, 0)
    }
}
