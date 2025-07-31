package fr.sncf.osrd.path.interfaces

interface Electrification {
    fun withElectricalProfile(profile: String): Electrification

    fun withPowerRestriction(powerRestriction: String): Electrification

    override fun equals(other: Any?): Boolean
}
