package fr.sncf.osrd.signaling.etcs_level2

import fr.sncf.osrd.signaling.BlockDiagReporter
import fr.sncf.osrd.signaling.SigBlock
import fr.sncf.osrd.signaling.SignalingSystemDriver
import fr.sncf.osrd.signaling.SignalingTrainState
import fr.sncf.osrd.sim_infra.api.SigParametersSchema
import fr.sncf.osrd.sim_infra.api.SigSettingsSchema
import fr.sncf.osrd.sim_infra.api.SigState
import fr.sncf.osrd.sim_infra.api.SigStateSchema

/**
 * PLACEHOLDER CODE copied from TVM signaling
 *
 * TODO: really implement ETCS signaling
 */
object ETCS_LEVEL2 : SignalingSystemDriver {
    override val id = "ETCS_LEVEL2"
    override val stateSchema = SigStateSchema { enum("aspect", listOf("VL", "OCCUPIED")) }
    override val settingsSchema = SigSettingsSchema { flag("Nf") }
    override val parametersSchema = SigParametersSchema {}

    override val isBlockDelimiterExpr = "true"
    override val isRouteDelimiterExpr = "Nf"
    override val isCurveBased = true

    override fun checkBlock(reporter: BlockDiagReporter, block: SigBlock) {
        // Check that we have the correct number of signals
        val expectedBlockSize = if (block.startsAtBufferStop || block.stopsAtBufferStop) 1 else 2
        if (block.signalTypes.size != expectedBlockSize) {
            val qualifier = if (block.signalTypes.size > expectedBlockSize) "many" else "few"
            reporter.reportBlock("too_${qualifier}_signals")
        }
    }

    override fun isConstrainingOnSight(
        signalState: SigState,
        trainState: SignalingTrainState,
    ): Boolean {
        return false
    }
}
