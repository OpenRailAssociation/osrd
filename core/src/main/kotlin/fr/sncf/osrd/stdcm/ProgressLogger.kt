package fr.sncf.osrd.stdcm

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.stdcm.graph.STDCMGraph
import fr.sncf.osrd.stdcm.graph.STDCMNode
import fr.sncf.osrd.stdcm.graph.logger
import fr.sncf.osrd.utils.units.Duration
import fr.sncf.osrd.utils.units.seconds
import java.time.Duration.*
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
) {
    private val thresholdDistance = 1.0 / nStepsProgress.toDouble()
    private var nSamplesReached = 1 // Avoids first node
    private var seenSteps = 0
    private var nextMemoryReport = Instant.now() + ofMillis(memoryReportTimeInterval.milliseconds)

    /** Process one node, logging it if it reaches a new threshold */
    fun processNode(node: STDCMNode) {
        seenSteps++
        val progress =
            (graph.bestPossibleTime - node.remainingTimeEstimation) / graph.bestPossibleTime
        if (progress >= thresholdDistance * nSamplesReached) {
            val block = node.infraExplorer.getCurrentBlock()
            val geo = makePathProps(graph.blockInfra, graph.rawInfra, block).getGeo().points[0]
            val str =
                "node sample for progress $nSamplesReached/$nStepsProgress: " +
                    "time=${node.time.toInt()}s, " +
                    "since departure=${node.timeSinceDeparture.toInt()}s, " +
                    "best remaining time=${node.remainingTimeEstimation.toInt()}s, " +
                    "loc=$geo, " +
                    "#visited nodes=$seenSteps"
            logger.info(str)
            while (progress >= thresholdDistance * nSamplesReached) nSamplesReached++
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
}
