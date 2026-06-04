package fr.sncf.osrd.railjson.schema.infra

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.common.Identified

data class RJSSwitch(
    /** The switch ID */
    override var id: String,
    /** The type of the switch */
    @Json(name = "switch_type") var switchType: String,
    /** The track sections connected to the ports of the switch */
    val ports: Map<String, RJSTrackEndpoint>,
    /** The delay when changing the position in seconds */
    @Json(name = "group_change_delay") var groupChangeDelay: Double,
    val extensions: RJSSwitchExtensions = RJSSwitchExtensions(null),
) : Identified

data class RJSSwitchExtensions(val sncf: RJSSwitchSncfExtension?)

data class RJSSwitchSncfExtension(val label: String)
