package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema


object BALtoTVM : SignalDriver {
    override val name = "BAL-TVM"
    override val inputSignalingSystem = "BAL"
    override val outputSignalingSystem = "TVM"


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
