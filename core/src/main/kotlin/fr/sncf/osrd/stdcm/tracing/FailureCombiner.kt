package fr.sncf.osrd.stdcm.tracing

import fr.sncf.osrd.conflicts.RequirementId
import fr.sncf.osrd.conflicts.RequirementType
import fr.sncf.osrd.stdcm.graph.STDCMNode

/** Keep track of conflicts. */
interface FailureRegister {
    /** Register a new conflict. */
    fun conflictCallback(
        parentNode: STDCMNode,
        timeLost: Double,
        cause: RequirementId,
        type: RequirementType,
    )
}

/**
 * Combine several `FailureRegisters`, to keep track of conflicts synchronously across these
 * registers.
 *
 * This class is currently used to register conflicts in a full failure register, for debug, and in
 * a failure register dedicated to work schedule conflicts.
 */
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
