package fr.sncf.osrd.stdcm.tracing

import com.squareup.moshi.Json
import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import fr.sncf.osrd.path.implementations.buildTrainPathFromBlock
import fr.sncf.osrd.stdcm.graph.STDCMGraph
import fr.sncf.osrd.stdcm.graph.STDCMNode
import fr.sncf.osrd.stdcm.graph.logger
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.seconds
import io.opentelemetry.api.common.Attributes
import io.opentelemetry.api.trace.Span
import java.time.Instant
import kotlin.math.pow

/**
 * This class is used to log some elements during the graph traversal. It logs a small number of
 * nodes, at most the specified number. Nodes are logged as they get closer to the destination.
 */
data class ProgressLogger(
    val graph: STDCMGraph,
    val nStepsProgress: Int = 10,
    val memoryReportTimeInterval: Duration = 10.seconds,
    val callback: ProgressCallback?,
) {
    private val thresholdDistance = 1.0 / nStepsProgress.toDouble()
    private var nSamplesReached = 1 // Avoids first node
    private var seenSteps = 0
    private var nextMemoryReport =
        Instant.now() + java.time.Duration.ofMillis(memoryReportTimeInterval.milliseconds)

    /** Process one node, logging it if it reaches a new threshold */
    fun processNode(node: STDCMNode) {
        seenSteps++
        val progress =
            (graph.bestPossibleTime - node.remainingTimeEstimation) / graph.bestPossibleTime
        if (progress.isInfinite()) {
            // Sometimes happens when departure and destination have some overlapping points.
            // Would cause infinite loops if we process normally.
            return
        }
        if (progress >= thresholdDistance * nSamplesReached) {
            val block = node.infraExplorer.getCurrentBlock()
            val geo =
                buildTrainPathFromBlock(graph.rawInfra, graph.blockInfra, block)
                    .getGeo()
                    .getPoints()[0]
            val str =
                "node sample for progress $nSamplesReached/$nStepsProgress: " +
                    "time=${node.timeData.earliestReachableTime.toInt()}s, " +
                    "since departure=${node.timeData.timeSinceDeparture.toInt()}s, " +
                    "best remaining time=${node.remainingTimeEstimation.toInt()}s, " +
                    "loc=$geo, " +
                    "#visited nodes=$seenSteps"
            logger.info(str)

            val eventAttributes =
                Attributes.builder()
                    .put("progress", nSamplesReached.toDouble() / nStepsProgress.toDouble())
                    .put("time", node.timeData.earliestReachableTime.toLong())
                    .put("time since departure", node.timeData.timeSinceDeparture.toLong())
                    .put("best remaining time", node.remainingTimeEstimation.toLong())
                    .put("location", geo.toString())
                    .put("n visited nodes", seenSteps.toLong())
                    .build()
            Span.current().addEvent("progress $nSamplesReached/$nStepsProgress", eventAttributes)

            while (progress >= thresholdDistance * nSamplesReached) nSamplesReached++
        }

        logNode(node)

        if (Instant.now() >= nextMemoryReport) {
            nextMemoryReport += java.time.Duration.ofMillis(memoryReportTimeInterval.milliseconds)
            val rt = Runtime.getRuntime()
            val max = rt.maxMemory()
            val free = rt.freeMemory()
            val total = rt.totalMemory()
            val used = total - free
            val mb = 2.0.pow(20.0)
            val str =
                "node #$seenSteps, memory tracing: " +
                    "used ${(used / mb).toInt()} / ${(max / mb).toInt()} MB"
            logger.info(str)
        }
    }

    fun logNode(node: STDCMNode): STDCMProgress {
        val block = node.infraExplorer.getCurrentBlock()
        val geo =
            buildTrainPathFromBlock(graph.rawInfra, graph.blockInfra, block).getGeo().getPoints()[0]
        val bestTravelTime =
            (node.timeData.earliestReachableTime + node.remainingTimeEstimation).toLong()
        val data =
            STDCMProgress(
                status = STDCMProgressStatus.IN_PROGRESS,
                point = STDCMProgress.STDCMProgressSampleCoordinates(geo.lat, geo.lon),
                bestTravelTime = bestTravelTime,
            )

        callback?.let { it(data) }
        return data
    }
}

data class STDCMProgress(
    @Json(name = "status") val status: STDCMProgressStatus,
    @Json(name = "point") val point: STDCMProgressSampleCoordinates,
    @Json(name = "best_travel_time") val bestTravelTime: Long,
) {
    data class STDCMProgressSampleCoordinates(
        @Json(name = "lat") val lat: Double,
        @Json(name = "lon") val lon: Double,
    )

    companion object {
        val adapter: JsonAdapter<STDCMProgress> =
            Moshi.Builder()
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(STDCMProgress::class.java)
    }
}

enum class STDCMProgressStatus {
    IN_PROGRESS,
    DONE,
}

typealias ProgressCallback = (STDCMProgress) -> Unit
