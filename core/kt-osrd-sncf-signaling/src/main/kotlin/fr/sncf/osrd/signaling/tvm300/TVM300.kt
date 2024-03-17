package fr.sncf.osrd.signaling.tvm300

import fr.sncf.osrd.signaling.BlockDiagReporter
import fr.sncf.osrd.signaling.SigBlock
import fr.sncf.osrd.signaling.SignalingSystemDriver
import fr.sncf.osrd.sim_infra.api.SigParametersSchema
import fr.sncf.osrd.sim_infra.api.SigSettingsSchema
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object TVM300 : SignalingSystemDriver {
    override val id = "TVM300"
    override val stateSchema = SigStateSchema { enum("aspect", listOf("300VL", "300(VL)", "270A", "220A", "16OA", "080A", "000", "RRR")) }
    override val settingsSchema = SigSettingsSchema { flag("Nf") }
    override val parametersSchema = SigParametersSchema {}
    override val isBlockDelimiterExpr = "true"

    private fun maxSpeedForState(state: SigState): Int {
        val aspect = state.getEnum("aspect")
        when (aspect) {
            "300VL" -> return 315
            "300(VL)" -> return 315
            "270A" -> return 315
            "220A" -> return 285
            "16OA" -> return 235
            "080A" -> return 170
            "000" -> return 80
            "RRR" -> return 0
            else -> throw IllegalArgumentException("Unknown aspect: $aspect")
        }
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
