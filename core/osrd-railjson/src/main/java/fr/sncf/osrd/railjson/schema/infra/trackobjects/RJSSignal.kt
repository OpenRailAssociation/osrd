package fr.sncf.osrd.railjson.schema.infra.trackobjects

import com.squareup.moshi.Json
import fr.sncf.osrd.railjson.schema.common.Identified
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection

class RJSSignal(
    override val track: String,
    override val position: Double,
    override val id: String,
    /** The track direction for which the signal applies */
    val direction: EdgeDirection,
    /** The distance at which the signal becomes visible */
    @Json(name = "sight_distance") val sightDistance: Double,
    /** Each logical signal can be of a different type and simulated independently */
    @Json(name = "logical_signals") val logicalSignals: List<LogicalSignal>,
    val extensions: RJSSignalExtensions = RJSSignalExtensions(null),
) : RJSTrackObject, Identified {
    class LogicalSignal(
        /**
         * The signaling system in which the signal works. Each signaling system has a set of roles,
         * such as movement authority or speed limits transmission.
         */
        @Json(name = "signaling_system") var signalingSystem: String,

        /**
         * The schema for allowed settings is defined by the signaling system. It's a list of
         * key=value entries.
         */
        var settings: Map<String, String>,

        /** The schema for allowed parameters is defined by the signaling system. */
        @Json(name = "default_parameters") var defaultParameters: Map<String, String>,
        @Json(name = "conditional_parameters")
        val conditionalParameters: List<ConditionalParameter>,

        /**
         * An optional list of next signaling systems with which the signal is allowed to interface.
         * This list will be used to look up drivers. If missing, the driver list is deduced from
         * surrounding signals. Drivers define how signals are driven by interfacing with the next
         * signal's signaling system, and computing the signal state. There can only be a unique
         * driver for each (input, output) signaling system pair.
         */
        @Json(name = "next_signaling_systems") val nextSignalingSystems: List<String>,
    ) {
        class ConditionalParameter(
            @Json(name = "on_route") val onRoute: String,
            val parameters: Map<String, String>,
        )
    }
}

data class RJSSignalExtensions(val sncf: RJSSignalSncfExtension?)

data class RJSSignalSncfExtension(val label: String, val side: String, val kp: String)
