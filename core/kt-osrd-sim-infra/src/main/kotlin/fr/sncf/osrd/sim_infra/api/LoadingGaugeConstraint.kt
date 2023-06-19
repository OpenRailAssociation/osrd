package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.indexing.StaticIdx


sealed interface LoadingGaugeType
typealias LoadingGaugeTypeId = StaticIdx<LoadingGaugeType>

interface LoadingGaugeConstraint {
    /** Returns true if a train of the given type is compatible  */
    @Suppress("INAPPLICABLE_JVM_NAME")
    @JvmName("isCompatibleWith")
    fun isCompatibleWith(trainType: LoadingGaugeTypeId): Boolean
}
