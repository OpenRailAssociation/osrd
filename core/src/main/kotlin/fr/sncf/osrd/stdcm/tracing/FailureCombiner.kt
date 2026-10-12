package fr.sncf.osrd.stdcm.tracing

import fr.sncf.osrd.conflicts.RequirementId
import fr.sncf.osrd.conflicts.RequirementType
import fr.sncf.osrd.stdcm.graph.STDCMNode

class FailureCombiner(val failureRegisters: List<FailureRegister> = ArrayList()) : FailureRegister {
    override fun conflictCallback(
        parentNode: STDCMNode,
        timeLost: Double,
        cause: RequirementId,
        type: RequirementType,
    ) {
        failureRegisters.forEach { it.conflictCallback(parentNode, timeLost, cause, type) }
    }
}
