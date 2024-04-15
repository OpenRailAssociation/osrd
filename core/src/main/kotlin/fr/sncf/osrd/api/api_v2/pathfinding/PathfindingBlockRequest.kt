package fr.sncf.osrd.api.api_v2.pathfinding

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.utils.json.DistanceAdapterFactory
import fr.sncf.osrd.utils.json.OffsetAdapterFactory
import fr.sncf.osrd.utils.units.Offset

class PathfindingBlockRequest(
    @Json(name = "rolling_stock_loading_gauge") val rollingStockLoadingGauge: RJSLoadingGaugeType,
    @Json(name = "rolling_stock_is_thermal") val rollingStockIsThermal: Boolean,
    @Json(name = "rolling_stock_supported_electrification")
    val rollingStockSupportedElectrification: List<String>,
    @Json(name = "rolling_stock_supported_signaling_systems")
    val rollingStockSupportedSignalingSystems: List<String>,
    val timeout: Double?,
    val infra: String,
    @Json(name = "expected_version") val expectedVersion: String,

    // One set of location by step, each step must be reached in order
    @Json(name = "path_items") val pathItems: List<Collection<TrackLocation>>
) {
    class TrackLocation(val track: String, val offset: Offset<TrackSection>)
}

val pathfindingRequestAdapter: JsonAdapter<PathfindingBlockRequest> =
    Moshi.Builder()
        .addLast(DistanceAdapterFactory())
        .addLast(OffsetAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(PathfindingBlockRequest::class.java)
