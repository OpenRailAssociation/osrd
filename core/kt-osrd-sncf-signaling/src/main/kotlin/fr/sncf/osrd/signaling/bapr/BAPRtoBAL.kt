package fr.sncf.osrd.signaling.bapr

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema


object BAPRtoBAL : SignalDriver {
    override val name = "BAPR-BAL"
    override val inputSignalingSystem = "BAL"
    override val outputSignalingSystem = "BAPR"

    private fun cascadePrimaryAspect(aspect: String): String {
        return when (aspect) {
            "VL" -> "VL"
            "S" -> "A"
            "C" -> "A"
            "A" -> "VL"
            else -> throw RuntimeException("unknown aspect: $aspect")
        }
    }

    override fun evalSignal(
        signal: SigSettings, stateSchema: SigStateSchema, maView: MovementAuthorityView?, limitView: SpeedLimitView?
    ): SigState {
        return stateSchema {
            assert(maView!!.hasNextSignal)
            value("aspect", cascadePrimaryAspect(maView.nextSignalState.getEnum("aspect")))
        }
    }

    override fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock) {
        // assert(signal.getFlag("distant"))
    }
}
