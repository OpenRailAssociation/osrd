package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.signaling.ProtectionStatus.*
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema


object BALtoBAL : SignalDriver {
    override val name = "BAL-BAL"
    override val inputSignalingSystem = "BAL"
    override val outputSignalingSystem = "BAL"

    private fun cascadePrimaryAspect(aspect: String): String {
        return when (aspect) {
            "VL" -> "VL"
            "A" -> "VL"
            "S" -> "A"
            "C" -> "A"
            else -> throw RuntimeException("unknown aspect: $aspect")
        }
    }

    override fun evalSignal(
        signal: SigSettings,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?
    ): SigState {
        return stateSchema {
            when (maView!!.protectionStatus) {
                NO_PROTECTED_ZONES -> throw RuntimeException("BAL signals always protect zones")
                INCOMPATIBLE -> {
                    assert(signal.getFlag("Nf"))
                    value("aspect", "C")
                }
                OCCUPIED -> value("aspect", "S")
                CLEAR -> {
                    if (!maView.hasNextSignal) {
                        value("aspect", "A")
                    }
                    else {
                        val nextSignalState = maView.nextSignalState
                        val nextAspect = nextSignalState.getEnum("aspect")
                        value("aspect", cascadePrimaryAspect(nextAspect))
                    }
                }
            }
        }
    }

    override fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock) {
    }
}
