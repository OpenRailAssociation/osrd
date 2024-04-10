package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdxSortedSet
import fr.sncf.osrd.utils.indexing.mutableStaticIdxArraySetOf

sealed interface LoadingGaugeType

typealias LoadingGaugeTypeId = StaticIdx<LoadingGaugeType>

data class LoadingGaugeConstraint(val blockedTypes: StaticIdxSortedSet<LoadingGaugeType>) {
    /** Returns true if a train of the given type is compatible */
    fun isCompatibleWith(trainType: LoadingGaugeTypeId): Boolean {
        return !blockedTypes.contains(trainType)
    }
}

fun fromAllowedSet(allowedTypes: Set<RJSLoadingGaugeType>): LoadingGaugeConstraint {
    val blockedTypes = mutableStaticIdxArraySetOf<LoadingGaugeType>()
    for (gaugeType in RJSLoadingGaugeType.entries) {
        if (!allowedTypes.contains(gaugeType)) {
            blockedTypes.add(StaticIdx(gaugeType.ordinal.toUInt()))
        }
    }
    return LoadingGaugeConstraint(blockedTypes)
}
