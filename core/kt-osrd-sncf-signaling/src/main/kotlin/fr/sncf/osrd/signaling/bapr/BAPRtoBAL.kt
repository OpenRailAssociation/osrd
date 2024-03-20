package fr.sncf.osrd.signaling.bapr

import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.sim_infra.api.SigParameters
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
            "(A)" -> "VL"
            "A" -> "VL"
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
        limitView: SpeedLimitView?
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
