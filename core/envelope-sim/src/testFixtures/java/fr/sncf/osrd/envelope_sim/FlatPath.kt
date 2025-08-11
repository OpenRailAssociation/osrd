package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.path.interfaces.PhysicsPath

class FlatPath(override val length: Double, private val slope: Double) : PhysicsPath {
    override fun getAverageGrade(begin: Double, end: Double): Double {
        return slope
    }

    override fun getMinGrade(begin: Double, end: Double): Double {
        return slope
    }
}
