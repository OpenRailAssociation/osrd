package fr.sncf.osrd.railjson.schema.infra

import fr.sncf.osrd.railjson.schema.common.Identified

data class RJSSwitchType(
    override val id: String,
    /** the names of the ports of the switch */
    val ports: List<String>,
    /** the groups of simultaneously activable edges between ports */
    val groups: Map<String, List<SwitchPortConnection>>,
) : Identified {
    class SwitchPortConnection(
        /** the name of the source port */
        var src: String?,
        /** the name of the destination port */
        var dst: String?,
    )

    companion object {
        val CLASSIC_TYPE: RJSSwitchType =
            RJSSwitchType(
                "point_switch",
                listOf("A", "B1", "B2"),
                mapOf(
                    "A_B1" to listOf(SwitchPortConnection("A", "B1")),
                    "A_B2" to listOf(SwitchPortConnection("A", "B2")),
                ),
            )

        val LINK: RJSSwitchType =
            RJSSwitchType(
                "link",
                listOf("A", "B"),
                mapOf("STATIC" to listOf(SwitchPortConnection("A", "B"))),
            )

        val CROSSING: RJSSwitchType =
            RJSSwitchType(
                "crossing",
                listOf("A1", "B1", "A2", "B2"),
                mapOf(
                    "STATIC" to
                        listOf(SwitchPortConnection("A1", "B1"), SwitchPortConnection("A2", "B2"))
                ),
            )
        val SINGLE_SLIP_SWITCH: RJSSwitchType =
            RJSSwitchType(
                "single_slip_switch",
                listOf("A1", "B1", "A2", "B2"),
                mapOf(
                    "STATIC" to
                        listOf(SwitchPortConnection("A1", "B1"), SwitchPortConnection("A2", "B2")),
                    "A1_B2" to listOf(SwitchPortConnection("A1", "B2")),
                ),
            )

        val DOUBLE_SLIP_SWITCH: RJSSwitchType =
            RJSSwitchType(
                "double_slip_switch",
                listOf("A1", "B1", "A2", "B2"),
                mapOf(
                    "A1_B1" to listOf(SwitchPortConnection("A1", "B1")),
                    "A1_B2" to listOf(SwitchPortConnection("A1", "B2")),
                    "A2_B1" to listOf(SwitchPortConnection("A2", "B1")),
                    "A2_B2" to listOf(SwitchPortConnection("A2", "B2")),
                ),
            )

        val BUILTIN_NODE_TYPES_LIST: List<RJSSwitchType> =
            listOf(CLASSIC_TYPE, LINK, CROSSING, SINGLE_SLIP_SWITCH, DOUBLE_SLIP_SWITCH)
    }
}
