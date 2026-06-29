package fr.sncf.osrd.geom

import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

const val AVERAGE_EARTH_RADIUS = 6371008.8

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

    fun haversineDistanceAsMeters(other: Point): Double {
        val dLon = Math.toRadians(other.lon - lon)
        val dLat = Math.toRadians(other.lat - lat)
        val lat1 = Math.toRadians(lat)
        val lat2 = Math.toRadians(other.lat)

        val a = sin(dLat / 2).pow(2) + sin(dLon / 2).pow(2) * cos(lat1) * cos(lat2)
        val theta = 2 * atan2(sqrt(a), sqrt(1 - a))
        return theta * AVERAGE_EARTH_RADIUS
    }

    override fun toString(): String {
        return String.format("{lat=%f, lon=%f}", lat, lon)
    }
}
