package fr.sncf.osrd.sim_infra_adapter

import fr.sncf.osrd.Helpers
import fr.sncf.osrd.railjson.schema.infra.RJSOperationalPoint
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSOperationalPointPart
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSlope
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

class PathTests {

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
        val slopes = path.getSlopes()
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(0.meters, 500.meters, 10.0),
            DistanceRangeMap.RangeMapEntry(500.meters, 1_500.meters, 15.0),
            DistanceRangeMap.RangeMapEntry(1_500.meters, 2_500.meters, .0),
            DistanceRangeMap.RangeMapEntry(2_500.meters, 3_000.meters, -5.0),
        ), slopes.asList())

        val pathBackward = pathFromTracks(infra, listOf("TA1", "TA0"), Direction.DECREASING, 950.meters, 2_950.meters)
        val slopesBackward = pathBackward.getSlopes()
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
        val opIdsWithOffset = path.getOperationalPointParts()
            .map { op -> WithOffset(infra.getOperationalPointPartName(op.value), op.offset) }
        assertEquals(listOf(
            WithOffset("point1", 500.meters),
            WithOffset("point1", 1_000.meters),
            WithOffset("point2", 1_500.meters),
        ), opIdsWithOffset)

        val pathBackward = pathFromTracks(infra, listOf("TA1", "TA0"), Direction.DECREASING, 0.meters, 2_950.meters)
        val opIdsWithOffsetBackward = pathBackward.getOperationalPointParts()
            .map { op -> WithOffset(infra.getOperationalPointPartName(op.value), op.offset) }
        assertEquals(listOf(
            WithOffset("point2", 0.meters),
            WithOffset("point2", 1_950.meters),
            WithOffset("point1", 2_450.meters),
            WithOffset("point1", 2_950.meters),
        ), opIdsWithOffsetBackward)
    }

    /** Build a path from track ids */
    private fun pathFromTracks(infra: LocationInfra, trackIds: List<String>,
                               dir: Direction, start: Distance, end: Distance
    ): Path {
        val chunkList = mutableDirStaticIdxArrayListOf<TrackChunk>()
        trackIds
            .map { id ->  infra.getTrackSectionFromId(id)!! }
            .flatMap { track -> infra.getDirTrackSectionChunks(track, dir) }
            .forEach { dirChunk -> chunkList.add(dirChunk) }
        return pathOf(infra, chunkList, start, end)
    }
}