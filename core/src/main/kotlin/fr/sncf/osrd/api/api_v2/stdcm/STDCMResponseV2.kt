package fr.sncf.osrd.api.api_v2.stdcm

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.api_v2.pathfinding.PathfindingBlockResponse
import fr.sncf.osrd.api.api_v2.pathfinding.polymorphicPathfindingResponseAdapter
import fr.sncf.osrd.api.api_v2.standalone_sim.SimulationResponse
import fr.sncf.osrd.api.api_v2.standalone_sim.polymorphicElectricalProfileAdapter
import fr.sncf.osrd.api.api_v2.standalone_sim.polymorphicSimulationResponseAdapter
import fr.sncf.osrd.api.api_v2.standalone_sim.polymorphicSpeedLimitSourceAdapter
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import java.time.ZonedDateTime

interface STDCMResponseV2

class STDCMSuccess(
    var simulation: SimulationResponse,
    var path: PathfindingBlockResponse,
    @Json(name = "departure_time") var departureTime: ZonedDateTime
) : STDCMResponseV2

class PathNotFound : STDCMResponseV2

val polymorphicSTDCMResponseAdapter: PolymorphicJsonAdapterFactory<STDCMResponseV2> =
    PolymorphicJsonAdapterFactory.of(STDCMResponseV2::class.java, "status")
        .withSubtype(STDCMSuccess::class.java, "success")
        .withSubtype(PathNotFound::class.java, "path_not_found")

val stdcmResponseAdapter: JsonAdapter<STDCMResponseV2> =
    Moshi.Builder()
        .addLast(polymorphicSTDCMResponseAdapter)
        .addLast(polymorphicSimulationResponseAdapter)
        .addLast(polymorphicElectricalProfileAdapter)
        .addLast(polymorphicSpeedLimitSourceAdapter)
        .addLast(polymorphicPathfindingResponseAdapter)
        .addLast(UnitAdapterFactory())
        .addLast(KotlinJsonAdapterFactory())
        .build()
        .adapter(STDCMResponseV2::class.java)
