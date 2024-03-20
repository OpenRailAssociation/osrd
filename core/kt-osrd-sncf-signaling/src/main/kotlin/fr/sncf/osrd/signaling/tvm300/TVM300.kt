package fr.sncf.osrd.signaling.tvm300

import fr.sncf.osrd.signaling.BlockDiagReporter
import fr.sncf.osrd.signaling.SigBlock
import fr.sncf.osrd.signaling.SignalingSystemDriver
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.sim_infra.api.SigParametersSchema
import fr.sncf.osrd.sim_infra.api.SigSettingsSchema
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object TVM300 : SignalingSystemDriver {
    override val id = "TVM300"
    override val stateSchema = SigStateSchema { enum("aspect", listOf("300VL", "300(VL)", "270A", "220A", "16OA", "080A", "000", "RRR", "OCCUPIED")) }
    override val settingsSchema = SigSettingsSchema { flag("Nf") }
    override val parametersSchema = SigParametersSchema {}
    override val isBlockDelimiterExpr = "true"

    private fun maxSpeedForState(state: SigState): Int {
        return when (val aspect = state.getEnum("aspect")) {
            "300VL" -> 315
            "300(VL)" -> 315
            "270A" -> 315
            "220A" -> 285
            "16OA" -> 235
            "080A" -> 170
            "000" -> 80
            "RRR" -> 0
            "OCCUPIED" -> 0
            else -> throw IllegalArgumentException("Unknown aspect: $aspect")
        }
    }

    override fun isCompatibleWithTrainState(signalState: SigState, trainState: SignalingTrainState): Boolean {
        return trainState.speed <= maxSpeedForState(signalState)
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
