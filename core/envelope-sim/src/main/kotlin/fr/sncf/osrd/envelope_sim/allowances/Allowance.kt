package fr.sncf.osrd.envelope_sim.allowances

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext

interface Allowance {
    fun apply(base: Envelope, context: EnvelopeSimContext): Envelope
}

/**
 * A range of allowance is a part of the path between [beginPos, endPos] that has a certain
 * allowance value Together, allowance ranges are supposed to cover the entire path. If a part of
 * the path has no specified value, the default one is used instead.
 */
data class AllowanceRange(val beginPos: Double, val endPos: Double, val value: AllowanceValue)

abstract class AllowanceValue {
    /** Returns the allowance for a section of a trip, divided over time */
    fun getSectionAllowanceTime(
        sectionTime: Double,
        totalTime: Double,
        sectionDistance: Double,
        totalDistance: Double,
    ): Double {
        val ratio = getSectionRatio(sectionTime, totalTime, sectionDistance, totalDistance)
        val totalAllowance = getAllowanceTime(totalTime, totalDistance)
        return ratio * totalAllowance
    }

    /** Returns the allowance, given the total time and distance of the trip */
    abstract fun getAllowanceTime(baseTime: Double, distance: Double): Double

    /** Returns the allowance, given the total time and distance of the trip */
    abstract fun getAllowanceRatio(baseTime: Double, distance: Double): Double

    /** Returns the share of the total allowance a given section gets */
    abstract fun getSectionRatio(
        sectionTime: Double,
        totalTime: Double,
        sectionDistance: Double,
        totalDistance: Double,
    ): Double

    /** A fixed time allowance */
    data class FixedTime(val time: Double) : AllowanceValue() {
        override fun getAllowanceTime(baseTime: Double, distance: Double): Double {
            return time
        }

        override fun getAllowanceRatio(baseTime: Double, distance: Double): Double {
            return time / baseTime
        }

        override fun getSectionRatio(
            sectionTime: Double,
            totalTime: Double,
            sectionDistance: Double,
            totalDistance: Double,
        ): Double {
            return sectionTime / totalTime
        }
    }

    /** An added percentage of total time */
    data class Percentage(var percentage: Double) : AllowanceValue() {
        override fun getAllowanceTime(baseTime: Double, distance: Double): Double {
            assert(percentage >= 0)
            return baseTime * (percentage / 100)
        }

        override fun getAllowanceRatio(baseTime: Double, distance: Double): Double {
            return percentage / 100
        }

        override fun getSectionRatio(
            sectionTime: Double,
            totalTime: Double,
            sectionDistance: Double,
            totalDistance: Double,
        ): Double {
            return sectionTime / totalTime
        }
    }

    /** Added time in minutes per 100 km */
    data class TimePerDistance(var timePerDistance: Double) : AllowanceValue() {
        override fun getAllowanceTime(baseTime: Double, distance: Double): Double {
            val n = distance / 100000 // number of portions of 100km in the train journey
            return timePerDistance * n * 60
        }

        override fun getAllowanceRatio(baseTime: Double, distance: Double): Double {
            return getAllowanceTime(baseTime, distance) / baseTime
        }

        override fun getSectionRatio(
            sectionTime: Double,
            totalTime: Double,
            sectionDistance: Double,
            totalDistance: Double,
        ): Double {
            return sectionDistance / totalDistance
        }
    }
}
