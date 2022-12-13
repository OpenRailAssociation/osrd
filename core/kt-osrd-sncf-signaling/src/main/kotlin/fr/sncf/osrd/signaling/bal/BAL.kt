package fr.sncf.osrd.signaling.bal

import fr.sncf.osrd.signaling.SigBlock
import fr.sncf.osrd.signaling.SignalingSystemDriver
import fr.sncf.osrd.sim_infra.api.SigSettingsSchema
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object BAL : SignalingSystemDriver {
    override val id = "BAL"
    override val stateSchema = SigStateSchema {
        enum("aspect", listOf("VL", "A", "S", "C"))
    }
    override val settingsSchema = SigSettingsSchema {
        flag("Nf")
    }
    override val isBlockDelimiterExpr = "true"

    override fun checkBlock(block: SigBlock) {
    }
}
