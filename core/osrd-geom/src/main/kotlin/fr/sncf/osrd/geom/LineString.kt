package fr.sncf.osrd.geom

import com.carrotsearch.hppc.DoubleArrayList
import java.lang.String
import java.util.*
import kotlin.Double
import kotlin.DoubleArray
import kotlin.assert
import kotlin.doubleArrayOf

data class LineString(
    /** A list of N coordinates (Y component, latitude) */
    val bufferLat: DoubleArray,
    /** A list of N coordinates (X component, longitude) */
    val bufferLon: DoubleArray,
    /** A cumulative list of N-1 distances between coordinates */
    val cumulativeLengths: DoubleArray,
) {
    init {
        assert(bufferLon.size == bufferLat.size) { "Expected the same length" }
        assert(bufferLon.size >= 2) { "LineString should contain at least 2 points" }
        assert(cumulativeLengths.size == bufferLon.size - 1)
    }

    val length: Double
        get() = cumulativeLengths[cumulativeLengths.size - 1]

    /**
     * Create a list of points from the buffers of a LineString
     *
     * @return a list of points
     */
    fun getPoints(): List<Point> {
        val points = ArrayList<Point>()
        for (i in bufferLon.indices) {
            points.add(Point(bufferLat[i], bufferLon[i]))
        }
        return points
    }

    /**
     * Reverse a LineString
     *
     * @return a new reverse LineString
     */
    fun reverse(): LineString {
        val newBufferLon = DoubleArray(bufferLon.size)
        val newBufferLat = DoubleArray(bufferLat.size)

        for (i in bufferLon.indices) {
            val revertI = bufferLon.size - i - 1
            newBufferLon[i] = bufferLon[revertI]
            newBufferLat[i] = bufferLat[revertI]
        }

        val newCumulativeLengths = DoubleArray(cumulativeLengths.size)
        var newCumulativeLength = 0.0
        for (i in 0..<cumulativeLengths.size - 1) {
            newCumulativeLength +=
                (cumulativeLengths[cumulativeLengths.size - i - 1] -
                    cumulativeLengths[cumulativeLengths.size - i - 2])
            newCumulativeLengths[i] = newCumulativeLength
        }
        newCumulativeLength += cumulativeLengths[0]
        newCumulativeLengths[newCumulativeLengths.size - 1] = newCumulativeLength

        return LineString(newBufferLat, newBufferLon, newCumulativeLengths)
    }

    /**
     * Interpolate a LineString
     *
     * @param distance a distance between 0 and cumulativeLength
     * @return the point within the geometry at the given distance
     */
    private fun interpolate(distance: Double): Point {
        assert(distance >= 0.0)
        assert(distance <= cumulativeLengths[cumulativeLengths.size - 1])

        // if we're at the first point
        if (distance == 0.0) return Point(bufferLat[0], bufferLon[0])

        var intervalIndex = Arrays.binarySearch(cumulativeLengths, distance)

        // if we're exactly on any other point
        if (intervalIndex >= 0)
            return Point(bufferLat[intervalIndex + 1], bufferLon[intervalIndex + 1])

        // if we're in-between points
        intervalIndex = -intervalIndex - 1

        // A -- P ---- B
        val startToA = if (intervalIndex > 0) cumulativeLengths[intervalIndex - 1] else 0.0
        val startToB = cumulativeLengths[intervalIndex]
        val ab = startToB - startToA
        val ap = distance - startToA
        assert(!java.lang.Double.isNaN(ap))
        var ratio = ap / ab

        val aLon = bufferLon[intervalIndex]
        val aLat = bufferLat[intervalIndex]

        // if ratio is undefined, A and B are the same point
        if (java.lang.Double.isNaN(ratio)) return Point(aLat, aLon)

        // clamp the linear interpolation ratio
        if (ratio < 0.0) ratio = 0.0
        if (ratio > 1.0) ratio = 1.0

        val bLon = bufferLon[intervalIndex + 1]
        val bLat = bufferLat[intervalIndex + 1]

        val a = Point(aLat, aLon)
        val b = Point(bLat, bLon)
        return WGS84Interpolator.interpolate(a, b, ratio)
    }

    /**
     * Interpolate a LineString
     *
     * @param distance normalize distance between 0 (origin) and 1 (endpoint)
     * @return the point within the geometry at the given distance
     */
    fun interpolateNormalized(distance: Double): Point {
        assert(distance <= 1)
        assert(distance >= 0)
        return interpolate(distance * cumulativeLengths[cumulativeLengths.size - 1])
    }

    /**
     * Truncate a LineString from the provided begin and end offsets begin and end are distance on
     * the LineString begin and end are between 0.0 and 1.0
     */
    fun slice(begin: Double, end: Double): LineString {
        assert(begin in 0.0..1.0)
        assert(end in 0.0..1.0)

        if (begin > end) return slice(end, begin).reverse()

        if (begin.compareTo(0.0) == 0 && end.compareTo(1.0) == 0) return this

        val newBufferLon = DoubleArrayList()
        val newBufferLat = DoubleArrayList()

        val firstPoint = interpolateNormalized(begin)
        newBufferLon.add(firstPoint.lon)
        newBufferLat.add(firstPoint.lat)

        var intervalBegin =
            Arrays.binarySearch(
                cumulativeLengths,
                begin * cumulativeLengths[cumulativeLengths.size - 1],
            )

        // binarySearch returns a negative position if it doesn't find the element, else it returns
        // a positive index interval + 1 gives us the index of the first element we wanted to add in
        // our slicedLinestring But we already add the firstPoint above, so we go for the second
        // element
        if (intervalBegin >= 0) intervalBegin += 2 else intervalBegin = -intervalBegin

        var intervalEnd =
            Arrays.binarySearch(
                cumulativeLengths,
                end * cumulativeLengths[cumulativeLengths.size - 1],
            )
        if (intervalEnd < 0) intervalEnd = -intervalEnd - 1

        // add intermediate points
        for (i in intervalBegin..intervalEnd) {
            newBufferLon.add(bufferLon[i])
            newBufferLat.add(bufferLat[i])
        }

        // add the last point
        val lastPoint = interpolateNormalized(end)
        newBufferLon.add(lastPoint.lon)
        newBufferLat.add(lastPoint.lat)

        return make(newBufferLat.toArray(), newBufferLon.toArray())
    }

    override fun toString(): kotlin.String {
        // The result can be imported as a WKT linestring
        // (e.g. can be logged to a CSV file and imported in QGIS)
        return ("LINESTRING(" +
            String.join(",", this.getPoints().map { "${it.lon} ${it.lat}" }) +
            ')')
    }

    companion object {
        /**
         * Create a LineString from the coordinates buffers (no need to give lengths and
         * cumulativeLength)
         *
         * @param bufferLat a double array with latitude coordinates
         * @param bufferLon a double array with longitude coordinates
         * @return a new LineString
         */
        fun make(bufferLat: DoubleArray, bufferLon: DoubleArray): LineString {
            val cumulativeLengths = DoubleArray(bufferLon.size - 1)
            var cumulativeLength = 0.0
            for (i in 0..<bufferLon.size - 1) {
                cumulativeLength +=
                    Point(bufferLat[i], bufferLon[i])
                        .distanceAsMeters(Point(bufferLat[i + 1], bufferLon[i + 1]))
                cumulativeLengths[i] = cumulativeLength
            }
            return LineString(bufferLat, bufferLon, cumulativeLengths)
        }

        /** Create a LineString from two points */
        fun make(start: Point, end: Point): LineString {
            return make(doubleArrayOf(start.lat, end.lat), doubleArrayOf(start.lon, end.lon))
        }

        /**
         * Concatenate many LineStrings and Compute the new cumulativeLength remove useless values
         * (if 2 values are the same) and compute the new length to fill the gap between two
         * LineStrings
         *
         * @param lineStringList is a list that contains LineStrings
         * @return a new LineString
         */
        fun concatenate(lineStringList: MutableList<LineString>): LineString {
            val newBufferLon = DoubleArrayList()
            val newBufferLat = DoubleArrayList()
            val newCumulativeLengths = DoubleArrayList()

            for (lineString in lineStringList) {
                if (!newBufferLon.isEmpty) {
                    val distance =
                        Point(
                                newBufferLat.get(newBufferLat.size() - 1),
                                newBufferLon.get(newBufferLon.size() - 1),
                            )
                            .distanceAsMeters(
                                Point(lineString.bufferLat[0], lineString.bufferLon[0])
                            )

                    if (distance < 1e-5) {
                        newBufferLon.removeAt(newBufferLon.size() - 1)
                        newBufferLat.removeAt(newBufferLat.size() - 1)
                    } else {
                        newCumulativeLengths.add(
                            distance + newCumulativeLengths.get(newCumulativeLengths.size() - 1)
                        )
                    }
                }
                newBufferLon.add(*lineString.bufferLon)
                newBufferLat.add(*lineString.bufferLat)
                var lastCumulativeLength = 0.0
                // used to add the length of the previous Linestring to make the lengths of the next
                // one cumulatives
                if (!newCumulativeLengths.isEmpty)
                    lastCumulativeLength = newCumulativeLengths.get(newCumulativeLengths.size() - 1)
                for (cumLength in lineString.cumulativeLengths) newCumulativeLengths.add(
                    cumLength + lastCumulativeLength
                )
            }
            return LineString(
                newBufferLat.toArray(),
                newBufferLon.toArray(),
                newCumulativeLengths.toArray(),
            )
        }
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (javaClass != other?.javaClass) return false

        other as LineString

        if (!bufferLat.contentEquals(other.bufferLat)) return false
        if (!bufferLon.contentEquals(other.bufferLon)) return false
        if (!cumulativeLengths.contentEquals(other.cumulativeLengths)) return false
        if (length != other.length) return false
        if (getPoints() != other.getPoints()) return false

        return true
    }

    override fun hashCode(): Int {
        var result = bufferLat.contentHashCode()
        result = 31 * result + bufferLon.contentHashCode()
        result = 31 * result + cumulativeLengths.contentHashCode()
        result = 31 * result + length.hashCode()
        result = 31 * result + getPoints().hashCode()
        return result
    }
}
