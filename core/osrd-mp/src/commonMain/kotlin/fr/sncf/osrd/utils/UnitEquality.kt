package fr.sncf.osrd.utils

import kotlin.math.abs

// A position delta lower than this value will be considered zero
// Going back and forth with Distance and double (meters) often causes 1e-3 errors,
// we need the tolerance to be higher than this
const val POSITION_EPSILON: Double = 1E-2
// A speed lower than this value will be considered zero
const val SPEED_EPSILON: Double = 1E-5
// An acceleration lower than this value will be considered zero
const val ACCELERATION_EPSILON: Double = 1E-5
const val TIME_EPSILON: Double = 1E-2

/** Returns true if the positions' difference is lower than epsilon */
fun arePositionsEqual(a: Double, b: Double): Boolean {
    return areDoublesEqual(a, b, POSITION_EPSILON)
}

/** Returns true if the speeds' difference is lower than an epsilon */
fun areSpeedsEqual(a: Double, b: Double): Boolean {
    return areDoublesEqual(a, b, SPEED_EPSILON)
}

/** Returns true if the accelerations' difference is lower than an epsilon */
fun areAccelerationsEqual(a: Double, b: Double): Boolean {
    return areDoublesEqual(a, b, ACCELERATION_EPSILON)
}

/** Returns true if the times' difference is lower than an epsilon */
fun areTimesEqual(a: Double, b: Double): Boolean {
    return areDoublesEqual(a, b, TIME_EPSILON)
}

fun isTimeStrictlyPositive(time: Double): Boolean {
    return time > TIME_EPSILON
}

private fun areDoublesEqual(a: Double, b: Double, delta: Double): Boolean {
    return abs(a - b) < delta
}
