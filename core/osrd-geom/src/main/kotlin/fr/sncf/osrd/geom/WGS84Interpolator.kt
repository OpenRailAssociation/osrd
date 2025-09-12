package fr.sncf.osrd.geom

import kotlin.math.atan
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.tan

object WGS84Interpolator {
    const val EARTH_RADIUS: Double = 6378160.0

    /**
     * Interpolates between two points. We project to EPSG:3857 to interpolate linearly there, it's
     * not quite correct but interpolating on a straight line will be displayed properly when shown
     * on maps.
     */
    fun interpolate(p1: Point, p2: Point, fraction: Double): Point {
        val projectedP1 = EPSG3857Point.Companion.from(p1)
        val projectedP2 = EPSG3857Point.Companion.from(p2)
        val interpolated =
            EPSG3857Point(
                projectedP1.x + (projectedP2.x - projectedP1.x) * fraction,
                projectedP1.y + (projectedP2.y - projectedP1.y) * fraction,
            )
        return interpolated.toWGS84()
    }

    @JvmRecord
    private data class EPSG3857Point(val x: Double, val y: Double) {
        fun toWGS84(): Point {
            val lat = Math.toDegrees(atan(exp(y / EARTH_RADIUS)) * 2 - Math.PI / 2)
            val lon = Math.toDegrees(x / EARTH_RADIUS)
            return Point(lat, lon)
        }

        companion object {
            fun from(p: Point): EPSG3857Point {
                val x = Math.toRadians(p.lon) * EARTH_RADIUS
                val y = ln(tan(Math.PI / 4 + Math.toRadians(p.lat) / 2)) * EARTH_RADIUS
                return EPSG3857Point(x, y)
            }
        }
    }
}
