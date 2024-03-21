package fr.sncf.osrd.signaling.tvm430

import fr.sncf.osrd.signaling.BlockDiagReporter
import fr.sncf.osrd.signaling.SigBlock
import fr.sncf.osrd.signaling.SignalingSystemDriver
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.sim_infra.api.*

object TVM430 : SignalingSystemDriver {
    override val id = "TVM430"
    override val stateSchema = SigStateSchema { enum("aspect", listOf("VL", "A", "S", "C")) }
    override val settingsSchema = SigSettingsSchema { flag("Nf") }
    override val parametersSchema = SigParametersSchema {}

    override val isBlockDelimiterExpr = "true"

    override fun checkBlock(reporter: BlockDiagReporter, block: SigBlock) {
        // Check that we have the correct number of signals
        val expectedBlockSize = if (block.startsAtBufferStop || block.stopsAtBufferStop) 1 else 2
        if (block.signalTypes.size != expectedBlockSize) {
            val qualifier = if (block.signalTypes.size > expectedBlockSize) "many" else "few"
            reporter.reportBlock("too_${qualifier}_signals")
        }
    }

    override fun isConstraining(signalState: SigData<SignalStateMarker>, trainState: SignalingTrainState): Boolean {
        return false
    }
}
