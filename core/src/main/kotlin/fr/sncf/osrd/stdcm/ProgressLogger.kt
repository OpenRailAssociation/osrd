package fr.sncf.osrd.stdcm

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
import java.time.Duration.*
import java.time.Instant
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * This class is used to log some elements during the graph traversal. It logs a small number of
 * nodes, at most the specified number. Nodes are logged as they get closer to the destination.
 */
data class ProgressLogger(
    val graph: STDCMGraph,
    val nStepsProgress: Int = 100,
    val nNodesRandomSample: Int = 2_000,
    val memoryReportTimeInterval: Duration = 10.seconds,
    val callback: ProgressCallback? = null,
) {
    private val thresholdDistance = 1.0 / nStepsProgress.toDouble()
    private var nSamplesReached = 1 // Avoids first node
    private var seenSteps = 0
    private var nextMemoryReport = Instant.now() + ofMillis(memoryReportTimeInterval.milliseconds)
    private val startTime = System.currentTimeMillis()

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
            val data = logNode(node, progress)
            logger.info(data.toString())
            val eventAttributes =
                Attributes.builder()
                    .put("progress", data.sampleCount.toDouble() / data.outOf.toDouble())
                    .put("time", data.simulationTime.toLong())
                    .put("time since departure", data.timeSinceDeparture.toLong())
                    .put("best remaining time", data.bestRemainingTime.toLong())
                    .put("location", data.coordinates.toString())
                    .put("n visited nodes", data.numberVisitedNodes.toLong())
                    .put("used mb", data.mbUsed.toLong())
                    .put("max mb", data.maxMb.toLong())
                    .build()
            Span.current().addEvent("progress $nSamplesReached/$nStepsProgress", eventAttributes)

            while (progress >= thresholdDistance * nSamplesReached) nSamplesReached++
        } else if (seenSteps % nNodesRandomSample == 0) {
            logNode(node, progress)
        }

        if (Instant.now() >= nextMemoryReport) {
            nextMemoryReport += ofMillis(memoryReportTimeInterval.milliseconds)
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

    fun logNode(node: STDCMNode, progress: Double): STDCMProgressSample {
        val block = node.infraExplorer.getCurrentBlock()
        val geo =
            buildTrainPathFromBlock(graph.rawInfra, graph.blockInfra, block)
                .getGeo()
                .getPoints()[0]

        val rt = Runtime.getRuntime()
        val max = rt.maxMemory()
        val free = rt.freeMemory()
        val total = rt.totalMemory()
        val used = total - free
        val mb = 2.0.pow(20.0)

        val data =
            STDCMProgressSample(
                sampleCount = floor(progress * nStepsProgress).roundToInt(),
                outOf = nStepsProgress,
                simulationTime = node.timeData.earliestReachableTime,
                timeSinceDeparture = node.timeData.timeSinceDeparture,
                bestRemainingTime = node.remainingTimeEstimation,
                coordinates = listOf(geo.lat, geo.lon),
                numberVisitedNodes = seenSteps,
                mbUsed = (used / mb).toInt(),
                maxMb = (max / mb).toInt(),
                timeSinceSearchStarted = (System.currentTimeMillis() - startTime) / 1000.0,
            )
        callback?.let { it(data) }
        return data
    }
}

data class STDCMProgressSample(
    @Json(name = "sample_count") val sampleCount: Int,
    @Json(name = "out_of") val outOf: Int,
    @Json(name = "simulation_time") val simulationTime: Double,
    @Json(name = "time_since_departure") val timeSinceDeparture: Double,
    @Json(name = "best_remaining_time") val bestRemainingTime: Double,
    @Json(name = "coordinates") val coordinates: List<Double>,
    @Json(name = "number_visited_nodes") val numberVisitedNodes: Int,
    @Json(name = "mb_used") val mbUsed: Int,
    @Json(name = "max_mb") val maxMb: Int,
    @Json(name = "time_since_search_started") val timeSinceSearchStarted: Double,
) {
    companion object {
        val adapter: JsonAdapter<STDCMProgressSample> =
            Moshi.Builder()
                .addLast(KotlinJsonAdapterFactory())
                .build()
                .adapter(STDCMProgressSample::class.java)
    }
}

typealias ProgressCallback = (STDCMProgressSample) -> Unit
