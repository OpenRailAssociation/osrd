package fr.sncf.osrd.stdcm

import fr.sncf.osrd.api.pathfinding.makePathProps
import fr.sncf.osrd.stdcm.graph.STDCMGraph
import fr.sncf.osrd.stdcm.graph.STDCMNode
import fr.sncf.osrd.stdcm.graph.logger

/**
 * This class is used to log some elements during the graph traversal. It logs a small number of
 * nodes, at most the specified number. Nodes are logged as they get closer to the destination.
 */
data class ProgressLogger(
    val graph: STDCMGraph,
    val nSteps: Int = 10,
) {
    private val thresholdDistance = 1.0 / nSteps.toDouble()
    private var nSamplesReached = 1 // Avoids first node

    /** Process one node, logging it if it reaches a new threshold */
    fun processNode(node: STDCMNode) {
        val progress =
            (graph.bestPossibleTime - node.remainingTimeEstimation) / graph.bestPossibleTime
        if (progress < thresholdDistance * nSamplesReached) return
        val block = node.infraExplorer.getCurrentBlock()
        val geo = makePathProps(graph.blockInfra, graph.rawInfra, block).getGeo().points[0]
        val str =
            "node sample $nSamplesReached/$nSteps: " +
                "time=${node.time.toInt()}s, " +
                "since departure=${node.timeSinceDeparture.toInt()}s, " +
                "best remaining time=${node.remainingTimeEstimation.toInt()}s, " +
                "loc=$geo"
        logger.info(str)
        while (progress >= thresholdDistance * nSamplesReached) nSamplesReached++
    }
}
