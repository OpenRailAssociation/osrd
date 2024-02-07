package fr.sncf.osrd.api.pathfinding.response

import com.google.common.base.MoreObjects
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage
import java.util.*

/** A point in the slope chart in the pathfinding response payload. */
class SlopeChartPointResult(position: Double, gradient: Double) {
    /** The position of the slope */
    var position = 0.0

    /** The slope gradient */
    var gradient = 0.0

    init {
        this.position = position
        this.gradient = gradient
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || javaClass != other.javaClass) return false
        val that = other as SlopeChartPointResult
        return that.position.compareTo(position) == 0 && that.gradient.compareTo(gradient) == 0
    }

    override fun hashCode(): Int {
        return Objects.hash(position, gradient)
    }

    @ExcludeFromGeneratedCodeCoverage
    override fun toString(): String {
        return MoreObjects.toStringHelper(this)
            .add("position", position)
            .add("gradient", gradient)
            .toString()
    }
}
