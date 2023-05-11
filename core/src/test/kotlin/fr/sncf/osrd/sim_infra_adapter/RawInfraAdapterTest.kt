package fr.sncf.osrd.sim_infra_adapter

import fr.sncf.osrd.Helpers
import fr.sncf.osrd.utils.units.DistanceRangeMap
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class RawInfraAdapterTest {
    @Test
    fun smokeAdaptTinyInfra() {
        val rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json")
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        adaptRawInfra(oldInfra)
    }

    @Test
    fun smokeAdaptSmallInfra() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        adaptRawInfra(oldInfra)
    }

    @ParameterizedTest
    @ValueSource(strings = ["small_infra/infra.json", "tiny_infra/infra.json"])
    fun testTrackChunksOnRoutes(infraPath: String) {
        val epsilon = 1e-2 // fairly high value, because we compare integer millimeters with float meters
        val rjsInfra = Helpers.getExampleInfra(infraPath)
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        val infra = adaptRawInfra(oldInfra)
        for (route in infra.routes.iterator()) {
            val oldRoute = oldInfra.reservationRouteMap[infra.getRouteName(route)]!!
            val chunks = infra.getChunksOnRoute(route)
            var offset = 0.meters
            for (chunk in chunks) {
                val end = offset + infra.getTrackChunkLength(chunk.value)
                val trackRangeViews = oldRoute.getTrackRanges(offset.meters, end.meters)!!
                assertTrue { trackRangeViews.size == 1 } // This may fail because of float rounding,
                                                         // but as long as it's true it makes testing much easier
                val trackRangeView = trackRangeViews[0]
                assertEquals(
                    trackRangeView.track.edge.id,
                    infra.getTrackSectionId(infra.getTrackFromChunk(chunk.value))
                )
                assertEquals(trackRangeView.length, infra.getTrackChunkLength(chunk.value).meters, epsilon)
                assertEquals(trackRangeView.track.direction.toKtDirection(), chunk.direction)

                offset = end
            }
            assertEquals(offset.meters, oldRoute.length, epsilon)
        }
    }

    @ParameterizedTest
    @ValueSource(strings = ["small_infra/infra.json", "tiny_infra/infra.json"])
    fun testChunkSlopes(infraPath: String) {
        val rjsInfra = Helpers.getExampleInfra(infraPath)
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        val infra = adaptRawInfra(oldInfra)
        for (route in infra.routes.iterator()) {
            val oldRoute = oldInfra.reservationRouteMap[infra.getRouteName(route)]!!
            val chunks = infra.getChunksOnRoute(route)
            var offset = 0.meters
            for (chunk in chunks) {
                val end = offset + infra.getTrackChunkLength(chunk.value)
                val trackRangeViews = oldRoute.getTrackRanges(offset.meters, end.meters)!!
                assertTrue { trackRangeViews.size == 1 } // This may fail because of float rounding,
                                                         // but as long as it's true it makes testing much easier
                val trackRangeView = trackRangeViews[0]

                val slopes = infra.getTrackChunkSlope(chunk)
                val refSlopes = trackRangeView.slopes

                assertEquals(
                    DistanceRangeMap.from(refSlopes),
                    slopes
                )
                offset = end
            }
        }
    }
}
