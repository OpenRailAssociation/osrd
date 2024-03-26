package fr.sncf.osrd.signaling.tvm300

import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.signaling.bal.BALtoBAL
import fr.sncf.osrd.sim_infra.api.SigParameters
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object TVM300toTVM300 : SignalDriver {
    override val name = "TVM300-TVM300"
    override val inputSignalingSystem = "TVM300"
    override val outputSignalingSystem = "TVM300"

    private fun cascadePrimaryAspect(aspect: String, parameters: SigParameters): String {
        return when (aspect) {
            "300VL" -> "300VL"
            "300(VL)" -> "300VL"
            "270A" -> "300(VL)"
            "220A" -> "270A"
            "160A" -> "220A"
            "080A" -> "160A"
            "000" -> "080A"
            "RRR" -> "000"
            "OCCUPIED" -> "RRR"
            else -> throw OSRDError.newAspectError(aspect)
        }
    }


    override fun evalSignal(
        signal: SigSettings,
        parameters: SigParameters,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?
    ): SigState {
        return stateSchema {
            when (maView!!.protectionStatus) {
                ProtectionStatus.NO_PROTECTED_ZONES -> throw OSRDError(ErrorType.BALUnprotectedZones)
                ProtectionStatus.INCOMPATIBLE -> value("aspect", "OCCUPIED")
                ProtectionStatus.OCCUPIED -> value("aspect", "OCCUPIED")
                ProtectionStatus.CLEAR -> {
                    if (!maView.hasNextSignal) {
                        value("aspect", "000")
                    } else {
                        val nextSignalState = maView.nextSignalState
                        val nextAspect = nextSignalState.getEnum("aspect")
                        value("aspect", cascadePrimaryAspect(nextAspect, parameters))
                    }
                }
            }
        }

    }

    override fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock) {}
}
