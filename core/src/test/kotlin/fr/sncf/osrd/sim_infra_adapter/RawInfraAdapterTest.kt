package fr.sncf.osrd.sim_infra_adapter

import fr.sncf.osrd.Helpers
import fr.sncf.osrd.railjson.schema.common.RJSWaypointRef
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection
import fr.sncf.osrd.railjson.schema.infra.RJSOperationalPoint
import fr.sncf.osrd.railjson.schema.infra.RJSRoute
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSOperationalPointPart
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSlope
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Distance
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
                    DistanceRangeMapImpl.from(refSlopes),
                    slopes
                )
                offset = end
            }
        }
    }

    /** Checks that we can load a route that starts at the edge of a track section, an edge case that happens
     * when loading a real infra but not on our generated infras */
    @Test
    fun adaptSmallInfraRouteWithEmptyTrackRange() {
        // The route goes from the end of TA1 to TA3, two tracks that are linked through switch PA0 in its LEFT config
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        rjsInfra.detectors.add(RJSTrainDetector(
            "det_at_transition", 1950.0, "TA1"
        ))
        rjsInfra.detectors.add(RJSTrainDetector(
            "det_end_new_route", 20.0, "TA3"
        ))
        val newRoute = RJSRoute(
            "new_route",
            RJSWaypointRef("det_at_transition", RJSWaypointRef.RJSWaypointType.DETECTOR),
            EdgeDirection.START_TO_STOP,
            RJSWaypointRef("det_end_new_route", RJSWaypointRef.RJSWaypointType.DETECTOR),
        )
        newRoute.switchesDirections["PA0"] = "LEFT"
        rjsInfra.routes = listOf(newRoute)
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        adaptRawInfra(oldInfra)
    }

    @Test
    fun testSmallInfraSlopes() {
        /*
                TA0                 TA1
        |------------------|-------------------|
        0        1         2         3        3.95  km
        |--------|---------|---------|---------|
            10        15        0        -5         slopes

            |----------------------------->         path forward (.5 to 3.5km)
                 <-------------------|              path backward (3 to 1km)
         */
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        for (track in rjsInfra.trackSections) {
            if (track.id.equals("TA0")) // 2km long
                track.slopes = listOf(
                    RJSSlope(0.0, 1_000.0, 10.0),
                    RJSSlope(1_000.0, 2_000.0, 15.0),
                )
            if (track.id.equals("TA1")) // 1.950km long
                track.slopes = listOf(
                    RJSSlope(1_000.0, 1_950.0, -5.0),
                )
        }
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        val infra = adaptRawInfra(oldInfra)

        val path = pathFromTracks(infra, listOf("TA0", "TA1"), Direction.INCREASING, 500.meters, 3_500.meters)
        val slopes = infra.getSlopesOnPath(path)
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(0.meters, 500.meters, 10.0),
            DistanceRangeMap.RangeMapEntry(500.meters, 1_500.meters, 15.0),
            DistanceRangeMap.RangeMapEntry(1_500.meters, 2_500.meters, .0),
            DistanceRangeMap.RangeMapEntry(2_500.meters, 3_000.meters, -5.0),
        ), slopes.asList())

        val pathBackward = pathFromTracks(infra, listOf("TA1", "TA0"), Direction.DECREASING, 950.meters, 2_950.meters)
        val slopesBackward = infra.getSlopesOnPath(pathBackward)
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(0.meters, 1_000.meters, .0),
            DistanceRangeMap.RangeMapEntry(1_000.meters, 2_000.meters, -15.0),
        ), slopesBackward.asList())
    }

    @Test
    fun testOperationalPoints() {
        /*
                TA0                 TA1
        |------------------|-------------------|
        0        1   1.5   2                  3.95  km
        ---------|----|----|-------------------|
                 1    1    2                   2    operational points

            |----------------------------->         path forward (.5 to 3.5km)
                 <-----------------------------|    path backward (3.95 to 1km)
         */
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        rjsInfra.operationalPoints = listOf(
            RJSOperationalPoint("point1", listOf(
                RJSOperationalPointPart("TA0", 1_000.0),
                RJSOperationalPointPart("TA0", 1_500.0),
            )),
            RJSOperationalPoint("point2", listOf(
                RJSOperationalPointPart("TA1", 0.0),
                RJSOperationalPointPart("TA1", 1_950.0),
            ))
        )
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        val infra = adaptRawInfra(oldInfra)
        val path = pathFromTracks(infra, listOf("TA0", "TA1"), Direction.INCREASING, 500.meters, 3_500.meters)
        val opIdsWithOffset = infra.getOperationalPointsOnPath(path)
            .map { op -> WithOffset(infra.getOperationalPointName(op.value), op.offset) }
        assertEquals(listOf(
            WithOffset("point1", 500.meters),
            WithOffset("point1", 1_000.meters),
            WithOffset("point2", 1_500.meters),
        ), opIdsWithOffset)

        val pathBackward = pathFromTracks(infra, listOf("TA1", "TA0"), Direction.DECREASING, 0.meters, 2_950.meters)
        val opIdsWithOffsetBackward = infra.getOperationalPointsOnPath(pathBackward)
            .map { op -> WithOffset(infra.getOperationalPointName(op.value), op.offset) }
        assertEquals(listOf(
            WithOffset("point2", 0.meters),
            WithOffset("point2", 1_950.meters),
            WithOffset("point1", 2_450.meters),
            WithOffset("point1", 2_950.meters),
        ), opIdsWithOffsetBackward)
    }

    /** Build a path from track ids */
    private fun pathFromTracks(infra: TrackInfra, trackIds: List<String>,
                               dir: Direction, start: Distance, end: Distance): Path {
        val chunkList = mutableDirStaticIdxArrayListOf<TrackChunk>()
        trackIds
            .map { id ->  infra.getTrackSectionFromId(id)!! }
            .flatMap { track -> infra.getDirTrackSectionChunks(track, dir) }
            .forEach { dirChunk -> chunkList.add(dirChunk) }
        return Path(chunkList, start, end)
    }
}
