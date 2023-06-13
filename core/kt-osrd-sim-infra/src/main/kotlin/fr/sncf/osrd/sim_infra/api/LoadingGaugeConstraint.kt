package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType

interface LoadingGaugeConstraint {
    /** Returns true if a train of the given type is compatible  */
    fun isCompatibleWith(trainType: RJSLoadingGaugeType): Boolean
}
