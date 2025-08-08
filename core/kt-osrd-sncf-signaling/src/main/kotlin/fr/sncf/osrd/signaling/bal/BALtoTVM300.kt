package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.SigParameters
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object BALtoTVM300 : SignalDriver {
    override val name = "BAL-TVM300"
    override val inputSignalingSystem = "BAL"
    override val outputSignalingSystem = "TVM300"

    private fun cascadePrimaryAspect(aspect: String): String {
        return when (aspect) {
            // TODO: should really be an execution aspect (160) but we can't have that since trains
            // don't react to signaling yet
            "VL" -> "300VL"
            "A" -> "300VL"
            "S" -> "000"
            "C" -> "000"
            else -> throw OSRDError.newAspectError(aspect)
        }
    }

    override fun evalSignal(
        signal: SigSettings,
        parameters: SigParameters,
        stateSchema: SigStateSchema,
        maView: MovementAuthorityView?,
        limitView: SpeedLimitView?,
    ): SigState {
        return stateSchema {
            when (maView!!.protectionStatus) {
                ProtectionStatus.NO_PROTECTED_ZONES ->
                    throw OSRDError(ErrorType.BALUnprotectedZones)
                ProtectionStatus.INCOMPATIBLE -> value("aspect", "OCCUPIED")
                ProtectionStatus.OCCUPIED -> value("aspect", "OCCUPIED")
                ProtectionStatus.CLEAR -> {
                    if (!maView.hasNextSignal) {
                        value("aspect", "000")
                    } else {
                        val nextSignalState = maView.nextSignalState
                        val nextAspect = nextSignalState.getEnum("aspect")
                        value("aspect", cascadePrimaryAspect(nextAspect))
                    }
                }
            }
        }
    }

    override fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock) {}
}
