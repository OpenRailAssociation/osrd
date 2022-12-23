package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.signaling.ProtectionStatus.*
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema


object BALtoBAPR : SignalDriver {
    override val name = "BAL-BAPR"
    override val inputSignalingSystem = "BAPR"
    override val outputSignalingSystem = "BAL"

    private fun cascadePrimaryAspect(aspect: String): String {
        return when (aspect) {
            "VL" -> "VL"
            "S" -> "A"
            "C" -> "A"
            else -> throw RuntimeException("unknown aspect: $aspect")
        }
    }

    override fun evalSignal(
        signal: SigSettings, stateSchema: SigStateSchema, maView: MovementAuthorityView?, limitView: SpeedLimitView?
    ): SigState {
        return stateSchema {
            assert(maView!!.hasNextSignal)
            assert(!maView.nextSignalSettings.getFlag("distant"))
            when (maView.protectionStatus) {
                NO_PROTECTED_ZONES -> throw RuntimeException("BAL signals always protect zones")
                INCOMPATIBLE -> value("aspect", "C")
                OCCUPIED -> value("aspect", "S")
                CLEAR -> {
                    val nextSignalState = maView.nextSignalState
                    val nextAspect = nextSignalState.getEnum("aspect")
                    value("aspect", cascadePrimaryAspect(nextAspect))
                }
            }
        }
    }

    override fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock) {
    }
}
