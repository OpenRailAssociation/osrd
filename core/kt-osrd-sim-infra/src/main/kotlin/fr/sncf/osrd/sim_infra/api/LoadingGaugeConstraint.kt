package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxSortedSet
import kotlinx.serialization.Serializable

sealed interface LoadingGaugeType

typealias LoadingGaugeTypeId = StaticIdx<LoadingGaugeType>

@Serializable
data class LoadingGaugeConstraint(val blockedTypes: StaticIdxSortedSet<LoadingGaugeType>) {
    /** Returns true if a train of the given type is compatible */
    fun isCompatibleWith(trainType: LoadingGaugeTypeId): Boolean {
        return !blockedTypes.contains(trainType)
    }
}
