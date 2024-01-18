package fr.sncf.osrd.signaling.tvm430

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.SigParameters
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object TVM430toBAL : SignalDriver {
    override val name = "TVM430-BAL"
    override val inputSignalingSystem = "TVM430"
    override val outputSignalingSystem = "BAL"

    override fun evalSignal(
        signal: SigSettings,
        parameters: SigParameters,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?
    ): SigState {
        return stateSchema { value("aspect", "VL") }
    }

    override fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock) {}
}
