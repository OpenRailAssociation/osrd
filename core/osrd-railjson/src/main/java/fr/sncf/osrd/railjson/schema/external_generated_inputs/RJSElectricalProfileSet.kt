package fr.sncf.osrd.railjson.schema.external_generated_inputs

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.railjson.schema.infra.trackranges.RJSTrackRange

class RJSElectricalProfileSet(val levels: List<RJSElectricalProfile>) {
    class RJSElectricalProfile(
        val value: String,
        @Json(name = "power_class") val powerClass: String,
        @Json(name = "track_ranges") val trackRanges: List<RJSTrackRange>,
    )

    companion object {
        @JvmField
        val adapter: JsonAdapter<RJSElectricalProfileSet> =
            Moshi.Builder()
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(RJSElectricalProfileSet::class.java)
    }
}
