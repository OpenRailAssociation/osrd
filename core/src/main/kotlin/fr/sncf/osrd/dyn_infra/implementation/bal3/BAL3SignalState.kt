package fr.sncf.osrd.dyn_infra.implementation.bal3

import fr.sncf.osrd.infra.api.signaling.SignalState

enum class BAL3SignalState(private val rgb: Int, private val isFree: Boolean) : SignalState {
    RED(0xFF0000, false),
    YELLOW(0xFFFF00, false),
    GREEN(0x00FF00, true);

    override fun getRGBColor(): Int {
        return rgb
    }

    override fun isFree(): Boolean {
        return isFree
    }
}