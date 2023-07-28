package fr.sncf.osrd.sim_infra_adapter

import fr.sncf.osrd.Helpers
import fr.sncf.osrd.api.pathfinding.PathfindingUtils.makePath
import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.geom.Point
import fr.sncf.osrd.railjson.schema.common.graph.ApplicableDirection
import fr.sncf.osrd.railjson.schema.geom.RJSLineString
import fr.sncf.osrd.railjson.schema.infra.RJSOperationalPoint
import fr.sncf.osrd.railjson.schema.infra.trackranges.*
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.train.TestTrains.MAX_SPEED
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Speed.Companion.fromMetersPerSecond
import fr.sncf.osrd.utils.units.meters
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import java.util.Map
import kotlin.math.absoluteValue
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
        val opIdsIdxWithOffset = path.getOperationalPointParts()
            .map { op -> Pair(infra.getOperationalPointPartName(op.value), op.offset) }
        assertEquals(listOf(
            Pair("point1", 500.meters),
            Pair("point1", 1_000.meters),
            Pair("point2", 1_500.meters),
        ), opIdsIdxWithOffset)

        val pathBackward = pathFromTracks(infra, listOf("TA1", "TA0"), Direction.DECREASING, 0.meters, 2_950.meters)
        val opIdsIdxWithOffsetBackward = pathBackward.getOperationalPointParts()
            .map { op -> Pair(infra.getOperationalPointPartName(op.value), op.offset) }
        assertEquals(listOf(
            Pair("point2", 0.meters),
            Pair("point2", 1_950.meters),
            Pair("point1", 2_450.meters),
            Pair("point1", 2_950.meters),
        ), opIdsIdxWithOffsetBackward)
    }

    @Test
    fun testSmallInfraCurves() {
        /*
        This test is simpler because the logic is the same as for slopes, with the code factorized.
        We only check that we fetch the right data.

                TA0
        |------------------|
        0        1         2   km
        |--------|---------|
            5k       10k       curve radius

            <--------|         path backward (1.5 to .5km)
         */
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        for (track in rjsInfra.trackSections)
            if (track.id.equals("TA0"))
                track.curves = listOf(
                    RJSCurve(0.0, 1_000.0, 5_000.0),
                    RJSCurve(1_000.0, 2_000.0, 10_000.0),
                )
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        val infra = adaptRawInfra(oldInfra)
        val pathBackward = pathFromTracks(infra, listOf("TA0"), Direction.DECREASING, 500.meters, 1_500.meters)
        val slopesBackward = pathBackward.getCurves()
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(0.meters, 500.meters, -10_000.0),
            DistanceRangeMap.RangeMapEntry(500.meters, 1_000.meters, -5_000.0),
        ), slopesBackward.asList())
    }

    @Test
    fun testSmallInfraGradients() {
        /*
        This test is simpler because the logic is the same as for slopes, with the code factorized.
        We only check that we fetch the right data.

                TA0
        |------------------|
        0        1         2   km
        |--------|---------|
            5        15        slopes
            5k                 radius

            <--------|         path backward (1.5 to .5km)
         */
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        for (track in rjsInfra.trackSections)
            if (track.id.equals("TA0")) {
                track.slopes = listOf(
                    RJSSlope(0.0, 1_000.0, 5.0),
                    RJSSlope(1_000.0, 2_000.0, 15.0),
                )
                track.curves = listOf(
                    RJSCurve(0.0, 1_000.0, 5_000.0),
                )
            }
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        val infra = adaptRawInfra(oldInfra)
        val pathBackward = pathFromTracks(infra, listOf("TA0"), Direction.DECREASING, 500.meters, 1_500.meters)
        val slopesBackward = pathBackward.getGradients()
        assertEquals(listOf(
            DistanceRangeMap.RangeMapEntry(0.meters, 500.meters, -15.0),
            DistanceRangeMap.RangeMapEntry(500.meters, 1_000.meters, -5.0 + 800.0 / 5_000.0),
        ), slopesBackward.asList())
    }

    @Test
    fun testSmallInfraGeom() {
        /*
                TA0                 TA1
        |------------------|-------------------|
        0        1         2         3        3.95      km
        |--------|---------|---------|---------|
     (0,0)     (1,0)     (1,1)     (2,1)   (2,1.95)     geo coordinates

            |----------------------------->             path forward (.5 to 3.5km)
                 <-------------------|                  path backward (3 to 1km)
         */
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        for (track in rjsInfra.trackSections) {
            if (track.id.equals("TA0"))
                track.geo = RJSLineString.make(listOf(0.0, 1.0, 1.0), listOf(0.0, 0.0, 1.0))
            if (track.id.equals("TA1"))
                track.geo = RJSLineString.make(listOf(1.0, 2.0, 2.0), listOf(1.0, 1.0, 1.95))
        }
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        val infra = adaptRawInfra(oldInfra)

        val path = pathFromTracks(infra, listOf("TA0", "TA1"), Direction.INCREASING, 500.meters, 3_500.meters)
        val geoForward = path.getGeo()
        assertLinestringEqual(
            LineString.make(
                doubleArrayOf(0.5, 1.0, 1.0, 2.0, 2.0),
                doubleArrayOf(0.0, 0.0, 1.0, 1.0, 1.5)
            ),
            geoForward,
            1e-5
        )

        val pathBackward = pathFromTracks(infra, listOf("TA1", "TA0"), Direction.DECREASING, 950.meters, 2_950.meters)
        val geoBackward = pathBackward.getGeo()
        assertLinestringEqual(
            LineString.make(
                doubleArrayOf(2.0, 1.0, 1.0),
                doubleArrayOf(1.0, 1.0, 0.0)
            ),
            geoBackward,
            1e-5
        )
    }

    @Test
    fun testSmallInfraCatenary() {
        /*
                TA0                 TA1
        |------------------|-------------------|
        0                  2         3        3.95      km
        |----------------------------|---------|
                      1500               25k

            |----------------------------->             path forward (.5 to 3.5km)
                 <------------------------|             path backward (3.5 to 1km)
         */
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        rjsInfra.catenaries = listOf(
            RJSCatenary("1500", listOf(
                RJSApplicableDirectionsTrackRange("TA0", ApplicableDirection.BOTH, 0.0, 2_000.0),
                RJSApplicableDirectionsTrackRange("TA1", ApplicableDirection.BOTH, 0.0, 1_000.0)
            )),
            RJSCatenary("25000", listOf(
                RJSApplicableDirectionsTrackRange("TA1", ApplicableDirection.BOTH, 1_000.0, 1_950.0)
            ))
        )
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        val infra = adaptRawInfra(oldInfra)

        val path = pathFromTracks(infra, listOf("TA0", "TA1"), Direction.INCREASING, 500.meters, 3_500.meters)
        val catenaryForward = path.getCatenary()
        assertEquals(
            listOf(
                DistanceRangeMap.RangeMapEntry(0.meters, 2_500.meters, "1500"),
                DistanceRangeMap.RangeMapEntry(2_500.meters, 3_000.meters, "25000"),
            ),
            catenaryForward.asList(),
        )

        val pathBackward = pathFromTracks(infra, listOf("TA1", "TA0"), Direction.DECREASING, 450.meters, 2_950.meters)
        val catenaryBackward = pathBackward.getCatenary()
        assertEquals(
            listOf(
                DistanceRangeMap.RangeMapEntry(0.meters, 500.meters, "25000"),
                DistanceRangeMap.RangeMapEntry(500.meters, 2_500.meters, "1500"),
            ),
            catenaryBackward.asList(),
        )
    }

    @Test
    fun testSmallInfraLoadingGauge() {
        /*
                TA0                 TA1
        |------------------|-------------------|
        0                  2         3        3.95      km
        |----------------------------|---------|
                      GA                 GC

                 <------------------------|             path backward (3.5 to 1km)
         */
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        for (track in rjsInfra.trackSections) {
            if (track.id.equals("TA0"))
                track.loadingGaugeLimits = listOf(
                    RJSLoadingGaugeLimit(0.0, 2_000.0, RJSLoadingGaugeType.GA)
                )
            if (track.id.equals("TA1"))
                track.loadingGaugeLimits = listOf(
                    RJSLoadingGaugeLimit(0.0, 1_000.0, RJSLoadingGaugeType.GA),
                    RJSLoadingGaugeLimit(1_000.0, 1_950.0, RJSLoadingGaugeType.GC),
                )
        }
        val oldInfra = Helpers.infraFromRJS(rjsInfra)
        val infra = adaptRawInfra(oldInfra)

        val pathBackward = pathFromTracks(infra, listOf("TA1", "TA0"), Direction.DECREASING, 450.meters, 2_950.meters)
        val loadingGauge = pathBackward.getLoadingGauge()
        assert(loadingGauge.get(0.meters)!!.isCompatibleWith(StaticIdx(RJSLoadingGaugeType.GC.ordinal.toUInt())))
        assert(!loadingGauge.get(1_000.meters)!!.isCompatibleWith(StaticIdx(RJSLoadingGaugeType.GC.ordinal.toUInt())))
    }

    @Test
    fun testSmallInfraSpeedLimits() {
        val rjsInfra = Helpers.getExampleInfra("small_infra/infra.json")!!
        val speedSection = RJSSpeedSection("speedSection", 30.0, Map.of("trainTag", 42.42),
            listOf(RJSApplicableDirectionsTrackRange("TA0", ApplicableDirection.BOTH, 0.0, 400.0)))
        rjsInfra.speedSections.add(speedSection)
        val infra = Helpers.fullInfraFromRJS(rjsInfra)
        val path = makePath(infra.blockInfra, infra.rawInfra, 1);
        val speedLimits = path.getSpeedLimits("trainTag")
        assertThat(speedLimits.asList()).containsExactlyElementsOf(
            listOf(
                DistanceRangeMap.RangeMapEntry(0.meters, 400.meters, fromMetersPerSecond(42.42)),
                DistanceRangeMap.RangeMapEntry(400.meters, 1_820.meters, fromMetersPerSecond(MAX_SPEED)))
        )
    }

    /** Assert that line strings are equal, with a certain tolerance for double values */
    private fun assertLinestringEqual(expected: LineString, actual: LineString, tolerance: Double) {
        val simplified = simplifyLineString(actual)
        assertEquals(expected.points.size, simplified.points.size)
        for ((expectedPoint, actualPoint) in expected.points zip simplified.points) {
            assertEquals(expectedPoint.x, actualPoint.x, tolerance)
            assertEquals(expectedPoint.y, actualPoint.y, tolerance)
        }
    }

    /** Remove aligned points from a linestring */
    private fun simplifyLineString(l: LineString): LineString {
        fun aligned(p1: Point, p2: Point, p3: Point): Boolean {
            val triangleArea = (p1.x * (p2.y - p3.y) +
                    p2.x * (p3.y - p1.y) +
                    p3.x * (p1.y - p2.y)).absoluteValue
            return triangleArea < 1e-5
        }
        val xs = arrayListOf<Double>()
        val ys = arrayListOf<Double>()
        for (i in 0 until l.points.size) {
            val p = l.points[i]
            if (i > 0 && i < l.points.size - 1 && aligned(p, l.points[i - 1], l.points[i + 1]))
                continue
            xs.add(p.x)
            ys.add(p.y)
        }
        return LineString.make(xs.toDoubleArray(), ys.toDoubleArray())
    }

    /** Build a path from track ids */
    private fun pathFromTracks(infra: LocationInfra, trackIds: List<String>,
                               dir: Direction, start: Distance, end: Distance
    ): Path {
        val chunkList = mutableDirStaticIdxArrayListOf<TrackChunk>()
        trackIds
            .map { id ->  infra.getTrackSectionFromName(id)!! }
            .flatMap { track -> infra.getTrackSectionChunks(track).dirIter(dir) }
            .forEach { dirChunk -> chunkList.add(dirChunk) }
        return buildPathFrom(infra, chunkList, start, end)
    }
}