package fr.sncf.osrd.path.interfaces

/** Legacy interface for the envelope module */
interface PhysicsPath {
    /** The length of the path, in meters */
    val length: Double

    /** The average slope on a given range, in m/km */
    fun getAverageGrade(begin: Double, end: Double): Double

    /** The lowest slope on a given range, in m/km */
    fun getMinGrade(begin: Double, end: Double): Double
}
