package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.SigParameters
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object BALtoETCS_LEVEL2 : SignalDriver {
    override val name = "BAL-ETCS_LEVEL2"
    override val inputSignalingSystem = "BAL"
    override val outputSignalingSystem = "ETCS_LEVEL2"

    override fun evalSignal(
        signal: SigSettings,
        parameters: SigParameters,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?,
    ): SigState {
        return stateSchema { value("aspect", "VL") }
    }

    override fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock) {}
}
