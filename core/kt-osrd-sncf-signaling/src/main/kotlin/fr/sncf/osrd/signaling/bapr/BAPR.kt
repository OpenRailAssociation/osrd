package fr.sncf.osrd.signaling.bapr

import fr.sncf.osrd.signaling.BlockDiagReporter
import fr.sncf.osrd.signaling.SigBlock
import fr.sncf.osrd.signaling.SignalingSystemDriver
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.sim_infra.api.*

object BAPR : SignalingSystemDriver {
    override val id = "BAPR"
    override val stateSchema = SigStateSchema { enum("aspect", listOf("VL", "A", "S", "C")) }
    override val settingsSchema = SigSettingsSchema {
        flag("Nf")
        flag("distant")
    }
    override val parametersSchema = SigParametersSchema {}
    override val isBlockDelimiterExpr = "!distant"

    override fun checkBlock(reporter: BlockDiagReporter, block: SigBlock) {
        // Check that we have the correct number of signals
        val expectedBlockSize = if (block.startsAtBufferStop || block.stopsAtBufferStop) 2 else 3
        if (block.signalTypes.size != expectedBlockSize) {
            val qualifier = if (block.signalTypes.size > expectedBlockSize) "many" else "few"
            reporter.reportBlock("too_${qualifier}_signals")
            return
        }

        // Check the signal types and attributes
        if (block.startsAtBufferStop) {
            if (!block.signalSettings[0].getFlag("distant"))
                reporter.reportBlock("missing_distant_signal")
        } else {
            if (block.signalSettings[0].getFlag("distant"))
                reporter.reportBlock("distant_entry_signal")

            if (block.signalTypes[1] != "BAPR") {
                reporter.reportBlock("non_bapr_distant_signal")
                return
            }

            // this should never happen, as non-distant signals delimit blocks
            assert(block.signalSettings[1].getFlag("distant"))
        }
    }

    override fun isConstraining(signalState: SigData<SignalStateMarker>, trainState: SignalingTrainState): Boolean {
        return signalState.getEnum("aspect") != "VL"
    }
}
