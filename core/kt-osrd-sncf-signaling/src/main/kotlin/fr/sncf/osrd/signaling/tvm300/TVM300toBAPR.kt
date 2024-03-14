package fr.sncf.osrd.signaling.tvm300

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object TVM300toBAPR : SignalDriver {
    override val name = "TVM300-BAPR"
    override val inputSignalingSystem = "TVM300"
    override val outputSignalingSystem = "BAPR"

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
