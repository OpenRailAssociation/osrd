package fr.sncf.osrd.signaling.bapr
import fr.sncf.osrd.signaling.SigBlock
import fr.sncf.osrd.signaling.SignalingSystemDriver
import fr.sncf.osrd.sim_infra.api.SigSettingsSchema
import fr.sncf.osrd.sim_infra.api.SigStateSchema

object BAPR : SignalingSystemDriver {
    override val id = "BAPR"
    override val stateSchema = SigStateSchema {
        enum("aspect", listOf("VL", "A", "S", "C"))
    }
    override val settingsSchema = SigSettingsSchema {
        flag("Nf")
        flag("distant")
    }
    override val isBlockDelimiterExpr = "!distant"

    override fun checkBlock(block: SigBlock) {
    }
}