package fr.sncf.osrd.signaling.etcs_level2

import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.SigParameters
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object ETCS_LEVEL2toETCS_LEVEL2 : SignalDriver {
    override val name = "ETCS_LEVEL2-ETCS_LEVEL2"
    override val inputSignalingSystem = "ETCS_LEVEL2"
    override val outputSignalingSystem = "ETCS_LEVEL2"

    override fun evalSignal(
        signal: SigSettings,
        parameters: SigParameters,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?,
    ): SigState {
        return stateSchema {
            when (maView!!.protectionStatus) {
                ProtectionStatus.NO_PROTECTED_ZONES ->
                    throw OSRDError(ErrorType.BALUnprotectedZones)
                ProtectionStatus.INCOMPATIBLE -> value("aspect", "OCCUPIED")
                ProtectionStatus.OCCUPIED -> value("aspect", "OCCUPIED")
                ProtectionStatus.CLEAR -> value("aspect", "VL")
            }
        }
    }

    override fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock) {}
}
