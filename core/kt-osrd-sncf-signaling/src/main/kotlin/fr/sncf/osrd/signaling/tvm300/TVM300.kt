package fr.sncf.osrd.signaling.tvm300

import fr.sncf.osrd.signaling.BlockDiagReporter
import fr.sncf.osrd.signaling.SigBlock
import fr.sncf.osrd.signaling.SignalingSystemDriver
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.kilometersPerHour

object TVM300 : SignalingSystemDriver {
    override val id = "TVM300"
    override val stateSchema = SigStateSchema { enum("aspect", listOf("300VL", "300(VL)", "270A", "220A", "160A", "080A", "000", "RRR", "OCCUPIED")) }
    override val settingsSchema = SigSettingsSchema { flag("Nf") }
    override val parametersSchema = SigParametersSchema {}
    override val isBlockDelimiterExpr = "true"

    private fun maxSpeedForState(state: SigState): Speed {
        return when (val aspect = state.getEnum("aspect")) {
            "300VL" -> 315.kilometersPerHour
            "300(VL)" -> 315.kilometersPerHour
            "270A" -> 315.kilometersPerHour
            "220A" -> 285.kilometersPerHour
            "160A" -> 235.kilometersPerHour
            "080A" -> 170.kilometersPerHour
            "000" -> 80.kilometersPerHour
            "RRR" -> 0.kilometersPerHour
            "OCCUPIED" -> 0.kilometersPerHour
            else -> throw IllegalArgumentException("Unknown aspect: $aspect")
        }
    }

    override fun isConstraining(signalState: SigData<SignalStateMarker>, trainState: SignalingTrainState): Boolean {
        return trainState.speed > maxSpeedForState(signalState)
    }

    override fun checkBlock(reporter: BlockDiagReporter, block: SigBlock) {
        // Check that we have the correct number of signals
        val expectedBlockSize = if (block.startsAtBufferStop || block.stopsAtBufferStop) 1 else 2
        if (block.signalTypes.size != expectedBlockSize) {
            val qualifier = if (block.signalTypes.size > expectedBlockSize) "many" else "few"
            reporter.reportBlock("too_${qualifier}_signals")
        }
    }
}
