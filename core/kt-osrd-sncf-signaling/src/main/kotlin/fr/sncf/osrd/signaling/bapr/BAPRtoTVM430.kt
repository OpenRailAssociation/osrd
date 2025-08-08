package fr.sncf.osrd.signaling.bapr

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.SigParameters
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object BAPRtoTVM430 : SignalDriver {
    override val name = "BAPR-TVM430"
    override val inputSignalingSystem = "BAPR"
    override val outputSignalingSystem = "TVM430"

    override fun evalSignal(
        signal: SigSettings,
        parameters: SigParameters,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?,
    ): SigState {
        return stateSchema { value("aspect", "300VL") }
    }

    override fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock) {}
}
