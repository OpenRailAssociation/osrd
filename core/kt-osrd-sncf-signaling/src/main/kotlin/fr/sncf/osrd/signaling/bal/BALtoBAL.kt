package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.reporting.exceptions.ErrorType
import fr.sncf.osrd.reporting.exceptions.OSRDError
import fr.sncf.osrd.signaling.*
import fr.sncf.osrd.signaling.ProtectionStatus.*
import fr.sncf.osrd.sim_infra.api.SigParameters
import fr.sncf.osrd.sim_infra.api.SigSettings
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.millimeters

object BALtoBAL : SignalDriver {
    override val name = "BAL-BAL"
    override val inputSignalingSystem = "BAL"
    override val outputSignalingSystem = "BAL"

    private fun cascadePrimaryAspect(aspect: String, parameters: SigParameters, nextDistanceToStop: Distance): String {
        return when (aspect) {
            "VL" -> "VL"
            "A" ->
                if (parameters.getFlag("jaune_cli")) {
                    "(A)"
                } else {
                    "VL"
                }
            "(A)" ->
                if (parameters.getFlag("jaune_cli") && nextDistanceToStop > 0.meters && nextDistanceToStop < 500.meters) {
                    "(A)"
                } else {
                    "VL"
                }
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
            when (maView!!.protectionStatus) {
                NO_PROTECTED_ZONES -> throw OSRDError(ErrorType.BALUnprotectedZones)
                INCOMPATIBLE -> {
                    if (!signal.getFlag("Nf")) // This can happen when doing partial simulation.
                     value("aspect", "S") // We take the most restrictive available aspect
                    else value("aspect", "C")
                    value("distance_to_stop", 0)
                }
                OCCUPIED -> {
                    value("aspect", "S")
                    value("distance_to_stop", 0)
                }
                CLEAR -> {
                    if (!maView.hasNextSignal) {
                        value("aspect", "A")
                        // TODO: maybe we should include the distance to the bufferstop in the MAView as the next signal distance?
                        value("distance_to_stop", -1)
                    } else {
                        val nextSignalState = maView.nextSignalState
                        val nextAspect = nextSignalState.getEnum("aspect")
                        val nextDistanceToStop = nextSignalState.getInt("distance_to_stop").millimeters
                        value("aspect", cascadePrimaryAspect(nextAspect, parameters, nextDistanceToStop))
                        if (nextDistanceToStop == (-1).millimeters)
                            value("distance_to_stop", -1)
                        else {
                            val distanceToNextSignal = maView.distanceToNextSignal!!
                            // FIXME: really, we should be able to encode longs, but this should work to demonstrate the concept
                            value("distance_to_stop", (distanceToNextSignal + nextDistanceToStop).millimeters.toInt() )
                        }
                    }
                }
            }
        }
    }

    override fun checkSignal(reporter: SignalDiagReporter, signal: SigSettings, block: SigBlock) {}
}
