package fr.sncf.osrd.signaling.tvm300

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema


object BALtoTVM300 : SignalDriver {
    override val name = "BAL-TVM300"
    override val inputSignalingSystem = "BAL"
    override val outputSignalingSystem = "TVM300"


    override fun evalSignal(
        signal: SigSettings, stateSchema: SigStateSchema, maView: MovementAuthorityView?, limitView: SpeedLimitView?
    ): SigState {
        return stateSchema {
            value("aspect", "VL")
        }

    }


    override fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock) {
    }
}
