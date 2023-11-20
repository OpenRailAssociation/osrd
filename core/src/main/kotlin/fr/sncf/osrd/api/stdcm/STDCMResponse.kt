package fr.sncf.osrd.api.stdcm

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.pathfinding.response.PathfindingResult
import fr.sncf.osrd.railjson.schema.common.ID
import fr.sncf.osrd.standalone_sim.result.StandaloneSimResult

class STDCMResponse
/** Constructor  */(
    var simulation: StandaloneSimResult,
    var path: PathfindingResult,
    @Json(
        name = "departure_time"
    ) var departureTime: Double
) {
    companion object {
        val adapter: JsonAdapter<STDCMResponse> = Moshi.Builder()
            .add(KotlinJsonAdapterFactory())
            .add(ID.Adapter.FACTORY)
            .build()
            .adapter(STDCMResponse::class.java)
    }
}
