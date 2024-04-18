package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxSortedSet

sealed interface LoadingGaugeType

typealias LoadingGaugeTypeId = StaticIdx<LoadingGaugeType>

data class LoadingGaugeConstraint(val blockedTypes: StaticIdxSortedSet<LoadingGaugeType>) {
    /** Returns true if a train of the given type is compatible */
    fun isCompatibleWith(trainType: LoadingGaugeTypeId): Boolean {
        return !blockedTypes.contains(trainType)
    }
}
