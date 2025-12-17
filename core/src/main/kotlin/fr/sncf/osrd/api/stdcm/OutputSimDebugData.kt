package fr.sncf.osrd.api.stdcm

import com.google.common.primitives.Doubles.max
import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.api.STDCMTimetableData
import fr.sncf.osrd.api.path_properties.PathPropResponse
import fr.sncf.osrd.api.path_properties.makePathPropResponse
import fr.sncf.osrd.api.path_properties.polymorphicElectrificationAdapter
import fr.sncf.osrd.api.standalone_sim.SimulationSuccess
import fr.sncf.osrd.api.standalone_sim.polymorphicElectricalProfileAdapter
import fr.sncf.osrd.api.standalone_sim.polymorphicSimulationResponseAdapter
import fr.sncf.osrd.api.standalone_sim.polymorphicSpeedLimitSourceAdapter
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.stdcm.STDCMResult
import fr.sncf.osrd.stdcm.graph.EngineeringAllowanceRange
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta
import fr.sncf.osrd.utils.units.seconds
import java.time.ZonedDateTime
import kotlin.math.min

/**
 * Contains data describing the output stdcm simulation. Meant to contain anything that may be
 * relevant to debug a past simulation without running it entirely again. Can be stored in an object
 * storage or similar.
 *
 * For now, this whole file only meant for debugging purposes.
 */
data class OutputSimDebugData(
    @Json(name = "sim_output") val simOutput: SimulationSuccess,
    @Json(name = "path_properties") val pathProperties: PathPropResponse,
    @Json(name = "other_requirements") val otherRequirements: List<TrainZoneRequirement>,
    @Json(name = "departure_time") val departureTime: ZonedDateTime,
    @Json(name = "engineering_allowances_ranges")
    val engineeringAllowanceRanges: List<EngineeringAllowanceRange>,
    @Json(name = "zone_locations") val zoneLocations: List<ZoneLocation>,
) {
    companion object {
        val adapter: JsonAdapter<OutputSimDebugData> =
            Moshi.Builder()
                .add(polymorphicSimulationResponseAdapter)
                .add(polymorphicElectricalProfileAdapter)
                .add(polymorphicSpeedLimitSourceAdapter)
                .add(polymorphicElectrificationAdapter)
                .addLast(UnitAdapterFactory())
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(OutputSimDebugData::class.java)
    }
}

data class TrainZoneRequirement(
    @Json(name = "zone_name") val zoneName: String,
    @Json(name = "begin_time") val beginTime: TimeDelta,
    @Json(name = "end_time") val endTime: TimeDelta,
    @Json(name = "train_name") val trainName: String?,
)

data class ZoneLocation(val name: String, val from: Offset<TrainPath>, val to: Offset<TrainPath>)

fun generateDebugData(
    rawInfra: RawInfra,
    path: STDCMResult,
    simulationResponse: SimulationSuccess,
    departureTime: ZonedDateTime,
    requirements: Map<ZoneId, List<STDCMTimetableData.DetailedRequirement>>,
): OutputSimDebugData {
    return OutputSimDebugData(
        simOutput = simulationResponse,
        pathProperties = makePathPropResponse(path.trainPath, rawInfra),
        otherRequirements = makeOtherRequirements(rawInfra, requirements, path),
        departureTime = departureTime,
        engineeringAllowanceRanges = path.engineeringAllowanceRanges,
        zoneLocations =
            path.trainPath.getZoneRanges().map {
                ZoneLocation(rawInfra.getZoneName(it.value), it.pathBegin, it.pathEnd)
            },
    )
}

fun makeOtherRequirements(
    rawInfra: RawInfra,
    requirements: Map<ZoneId, List<STDCMTimetableData.DetailedRequirement>>,
    path: STDCMResult,
): List<TrainZoneRequirement> {
    val res = mutableListOf<TrainZoneRequirement>()
    val minRelevantTime = -3_600.0
    val maxRelevantTime = path.envelope.totalTime + 3_600.0
    for (zoneRange in path.trainPath.getZoneRanges()) {
        val metadataList = requirements[zoneRange.value] ?: continue
        for (metadata in metadataList) {
            val beginTime = max(minRelevantTime, metadata.from - path.departureTime)
            val endTime = min(maxRelevantTime, metadata.to - path.departureTime)
            if (endTime < beginTime) continue
            res.add(
                TrainZoneRequirement(
                    zoneName = rawInfra.getZoneName(zoneRange.value),
                    beginTime = beginTime.seconds,
                    endTime = endTime.seconds,
                    trainName = metadata.trainName,
                )
            )
        }
    }
    return res
}
