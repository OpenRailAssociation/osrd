package fr.sncf.osrd.api.pathfinding.response

import com.google.common.base.MoreObjects
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage
import java.util.*

/** A point in the curve chart in the pathfinding response payload. */
class CurveChartPointResult(var position: Double, var radius: Double) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || javaClass != other.javaClass) return false
        val that = other as CurveChartPointResult
        return that.position.compareTo(position) == 0 && that.radius.compareTo(radius) == 0
    }

    override fun hashCode(): Int {
        return Objects.hash(position, radius)
    }

    @ExcludeFromGeneratedCodeCoverage
    override fun toString(): String {
        return MoreObjects.toStringHelper(this)
            .add("position", position)
            .add("radius", radius)
            .toString()
    }
}
