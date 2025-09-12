package fr.sncf.osrd.geom

import kotlin.math.cos
import kotlin.math.sqrt

@JvmRecord
data class Point(@JvmField val lat: Double, @JvmField val lon: Double) {
    /**
     * Returns the distance between this point and another in meters. Uses equirectangular distance
     * approximation (very fast but not 100% accurate)
     */
    fun distanceAsMeters(other: Point): Double {
        val lon1 = Math.toRadians(lon)
        val lon2 = Math.toRadians(other.lon)
        val lat1 = Math.toRadians(lat)
        val lat2 = Math.toRadians(other.lat)
        val xDiff = (lon1 - lon2) * cos(0.5 * (lat1 + lat2))
        val yDiff = lat1 - lat2
        return WGS84Interpolator.EARTH_RADIUS * sqrt(xDiff * xDiff + yDiff * yDiff)
    }

    override fun toString(): String {
        return String.format("{lat=%f, lon=%f}", lat, lon)
    }
}
