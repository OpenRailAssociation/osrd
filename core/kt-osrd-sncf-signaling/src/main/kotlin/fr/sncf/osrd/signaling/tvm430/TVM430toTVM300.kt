package fr.sncf.osrd.signaling.tvm430

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object TVM430toTVM300 : SignalDriver {
    override val name = "TVM430-TVM300"
    override val inputSignalingSystem = "TVM430"
    override val outputSignalingSystem = "TVM300"

    override fun evalSignal(
        signal: SigSettings,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?
    ): SigState {
        return stateSchema { value("aspect", "VL") }
    }

    override fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock) {}
}
