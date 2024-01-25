package fr.sncf.osrd.infra.implementation.tracks.undirected

import com.google.common.collect.ImmutableSet
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.sim_infra.api.LoadingGaugeConstraint
import fr.sncf.osrd.sim_infra.api.LoadingGaugeTypeId

class LoadingGaugeConstraintImpl(blockedTypes: ImmutableSet<RJSLoadingGaugeType>) :
    LoadingGaugeConstraint {
    private val blockedTypes: ImmutableSet<LoadingGaugeTypeId>

    init {
        val builder = ImmutableSet.builder<LoadingGaugeTypeId>()
        for (blockedType in blockedTypes) builder.add(
            LoadingGaugeTypeId(blockedType.ordinal.toUInt())
        )
        this.blockedTypes = builder.build()
    }

    override fun isCompatibleWith(trainType: LoadingGaugeTypeId): Boolean {
        return !blockedTypes.contains(trainType)
    }

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is LoadingGaugeConstraintImpl) return false
        if (blockedTypes != other.blockedTypes) return false
        return true
    }
}
