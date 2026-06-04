package fr.sncf.osrd.railjson.schema.infra

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.railjson.schema.common.ID
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSBufferStop
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSTrainDetector
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSElectrification
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSLevelCrossing
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSNeutralSection
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSSpeedSection

data class RJSInfra(
    /** The version of the infra format used */
    val version: String,

    /** A simple graph of track sections. */
    @Json(name = "track_sections") val trackSections: Collection<RJSTrackSection>,

    /** Switches are at the ends of track sections, and link those together. */
    val switches: Collection<RJSSwitch>,

    /** The list of all operational points. Finding reverse dependencies is up to the user. */
    @Json(name = "operational_points") val operationalPoints: Collection<RJSOperationalPoint>,

    /** The list of routes */
    val routes: Collection<RJSRoute>,

    /** The map of switch types */
    @Json(name = "extended_switch_types") val switchTypes: List<RJSSwitchType>,
    val signals: List<RJSSignal>,
    @Json(name = "buffer_stops") val bufferStops: List<RJSBufferStop>,
    val detectors: List<RJSTrainDetector>,
    @Json(name = "speed_sections") val speedSections: List<RJSSpeedSection>,
    val electrifications: List<RJSElectrification>,
    @Json(name = "neutral_sections") val neutralSections: List<RJSNeutralSection>,
    @Json(name = "level_crossings") val levelCrossings: List<RJSLevelCrossing>,
) {
    companion object {
        /** Moshi adapter used to serialize and deserialize RJSInfra */
        @JvmField
        val adapter: JsonAdapter<RJSInfra> =
            Moshi.Builder()
                .add(ID.Adapter.FACTORY)
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter<RJSInfra>(RJSInfra::class.java)

        @Transient const val CURRENT_VERSION: String = "3.5.3"
    }
}
