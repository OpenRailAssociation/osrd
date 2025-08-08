package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.signaling.ProtectionStatus.*
import fr.sncf.osrd.sim_infra.api.SigParameters
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object BALtoBAL : SignalDriver {
    override val name = "BAL-BAL"
    override val inputSignalingSystem = "BAL"
    override val outputSignalingSystem = "BAL"

    private fun cascadePrimaryAspect(aspect: String, parameters: SigParameters): String {
        return when (aspect) {
            "VL" -> "VL"
            "A" ->
                if (parameters.getFlag("jaune_cli")) {
                    "(A)"
                } else {
                    "VL"
                }
            "(A)" -> "VL"
            "S" -> "A"
            "C" -> "A"
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
                NO_PROTECTED_ZONES -> throw OSRDError(ErrorType.BALUnprotectedZones)
                INCOMPATIBLE -> {
                    if (!signal.getFlag("Nf")) // This can happen when doing partial simulation.
                     value("aspect", "S") // We take the most restrictive available aspect
                    else value("aspect", "C")
                }
                OCCUPIED -> value("aspect", "S")
                CLEAR -> {
                    if (!maView.hasNextSignal) {
                        value("aspect", "A")
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
