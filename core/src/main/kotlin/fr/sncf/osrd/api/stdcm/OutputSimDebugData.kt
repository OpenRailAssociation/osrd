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
import fr.sncf.osrd.conflicts.RequirementId
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.ZoneId
import fr.sncf.osrd.stdcm.STDCMCompleteResult
import fr.sncf.osrd.stdcm.graph.EngineeringAllowanceRange
import fr.sncf.osrd.stdcm.graph.STDCMEdge
import fr.sncf.osrd.stdcm.graph.STDCMGraph
import fr.sncf.osrd.utils.json.UnitAdapterFactory
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.TimeDelta
import fr.sncf.osrd.utils.units.seconds
import java.time.Duration.ofMillis
import java.time.ZonedDateTime
import kotlin.math.min

// Include occupancy for other train up to this amount of seconds before the new train departure and
// after its arrival
private const val includedOccupancyMargin = 3_600.0

/**
 * Contains data describing the output stdcm simulation. Meant to contain anything that may be
 * relevant to debug a past simulation without running it entirely again. Can be stored in an object
 * storage or similar.
 *
 * For now, this whole file only meant for debugging purposes.
 */
data class OutputSimDebugData(
    @Json(name = "sim_output") val simOutput: SimulationSuccess?,
    @Json(name = "path_properties") val pathProperties: PathPropResponse,
    @Json(name = "other_requirements") val otherRequirements: List<TrainZoneRequirement>,
    @Json(name = "departure_time") val departureTime: ZonedDateTime,
    @Json(name = "engineering_allowances_ranges")
    val engineeringAllowanceRanges: List<EngineeringAllowanceRange>,
    @Json(name = "zone_locations") val zoneLocations: List<ZoneLocation>,
    @Json(name = "train_times") val trainTimes: List<TimeDelta>,
    @Json(name = "train_positions") val trainPositions: List<Offset<PhysicsPath>>,
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
    val source: RequirementId?,
)

data class ZoneLocation(
    val name: String,
    val from: Offset<PhysicsPath>,
    val to: Offset<PhysicsPath>,
)

fun generateDebugData(
    rawInfra: RawInfra,
    path: STDCMCompleteResult,
    simulationResponse: SimulationSuccess,
    departureTime: ZonedDateTime,
    requirements: Map<ZoneId, List<STDCMTimetableData.DetailedRequirement>>,
): OutputSimDebugData {
    val minRelevantTime = -includedOccupancyMargin
    val maxRelevantTime =
        path.envelope.totalTime + path.stopResults.sumOf { it.duration } + includedOccupancyMargin
    return OutputSimDebugData(
        simOutput = simulationResponse,
        pathProperties = makePathPropResponse(path.trainPath, rawInfra),
        otherRequirements =
            makeOtherRequirements(
                rawInfra,
                requirements,
                path.departureTime,
                minRelevantTime,
                maxRelevantTime,
                path.trainPath,
            ),
        departureTime = departureTime,
        engineeringAllowanceRanges = path.engineeringAllowanceRanges,
        zoneLocations =
            path.trainPath.getZoneRanges().map {
                ZoneLocation(rawInfra.getZoneName(it.value), it.pathBegin, it.pathEnd)
            },
        trainTimes = simulationResponse.finalOutput.times,
        trainPositions = simulationResponse.finalOutput.positions,
    )
}

fun generatePartialDebugData(
    rawInfra: RawInfra,
    blockInfra: BlockInfra,
    edges: List<STDCMEdge>,
    searchMetadata: STDCMGraph.SearchMetadata,
    allowanceRanges: List<EngineeringAllowanceRange>,
): OutputSimDebugData {
    val lastEdge = edges.last()
    val timeData = lastEdge.timeData
    val trainPath = lastEdge.infraExplorer.buildFullPath(rawInfra, blockInfra)
    val departureTime =
        searchMetadata.originalStartTime.plus(ofMillis((timeData.departureTime * 1000).toLong()))
    val minRelevantTime = -includedOccupancyMargin
    val maxRelevantTime = timeData.earliestReachableTime + includedOccupancyMargin
    return OutputSimDebugData(
        simOutput = null,
        pathProperties = makePathPropResponse(trainPath, rawInfra),
        otherRequirements =
            makeOtherRequirements(
                rawInfra,
                searchMetadata.requirementMetadata,
                timeData.departureTime,
                minRelevantTime,
                maxRelevantTime,
                trainPath,
            ),
        departureTime = departureTime,
        engineeringAllowanceRanges = allowanceRanges,
        zoneLocations =
            trainPath.getZoneRanges().map {
                ZoneLocation(rawInfra.getZoneName(it.value), it.pathBegin, it.pathEnd)
            },
        trainTimes =
            edges.map {
                (it.timeData.getUpdatedEarliestReachableTime(timeData) - timeData.departureTime)
                    .seconds
            },
        trainPositions = edges.map { it.infraExplorer.getCurrentBlockRange().pathBegin },
    )
}

fun makeOtherRequirements(
    rawInfra: RawInfra,
    requirements: Map<ZoneId, List<STDCMTimetableData.DetailedRequirement>>,
    departureTimeDelta: Double,
    minRelevantTime: Double,
    maxRelevantTime: Double,
    trainPath: TrainPath,
): List<TrainZoneRequirement> {
    val res = mutableListOf<TrainZoneRequirement>()
    for (zoneRange in trainPath.getZoneRanges()) {
        val metadataList = requirements[zoneRange.value] ?: continue
        for (metadata in metadataList) {
            val beginTime = max(minRelevantTime, metadata.from - departureTimeDelta)
            val endTime = min(maxRelevantTime, metadata.to - departureTimeDelta)
            if (endTime < beginTime) continue
            res.add(
                TrainZoneRequirement(
                    zoneName = rawInfra.getZoneName(zoneRange.value),
                    beginTime = beginTime.seconds,
                    endTime = endTime.seconds,
                    source = metadata.source,
                )
            )
        }
    }
    return res
}
