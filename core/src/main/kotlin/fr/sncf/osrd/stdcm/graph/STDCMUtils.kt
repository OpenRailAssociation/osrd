package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.sim_infra.impl.buildChunkPath
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*

/** Returns the offset of the stops on the given block, starting at startOffset */
fun getStopOnBlock(
    graph: STDCMGraph,
    block: BlockId,
    startOffset: Offset<Block>,
    waypointIndex: Int
): Offset<Block>? {
    var mutWaypointIndex = waypointIndex
    val res = ArrayList<Offset<Block>>()
    while (
        mutWaypointIndex + 1 < graph.steps.size && !graph.steps[mutWaypointIndex + 1].stop
    ) mutWaypointIndex++ // Only the next point where we actually stop matters here
    if (mutWaypointIndex + 1 >= graph.steps.size) return null
    val nextStep = graph.steps[mutWaypointIndex + 1]
    if (!nextStep.stop) return null
    for (endLocation in nextStep.locations) {
        if (endLocation.edge == block) {
            val offset = endLocation.offset - startOffset.distance
            if (offset >= Offset(0.meters)) res.add(offset)
        }
    }
    return if (res.isEmpty()) null else Collections.min(res)
}

/** Create a TrainPath instance from a list of edge ranges */
fun makeChunkPathFromEdges(graph: STDCMGraph, edges: List<STDCMEdge>): ChunkPath {
    val blocks = edges.stream().map { edge -> edge.block }.distinct().toList()
    val totalPathLength =
        Length<Path>(
            Distance(
                millimeters =
                    edges.stream().mapToLong { edge -> (edge.length.distance).millimeters }.sum()
            )
        )
    val firstOffset = Offset<Path>(edges[0].envelopeStartOffset.distance)
    val lastOffset = totalPathLength + firstOffset.distance
    val chunks = MutableDirStaticIdxArrayList<TrackChunk>()
    for (block in blocks) for (chunk in graph.blockInfra.getTrackChunksFromBlock(block)) chunks.add(
        chunk
    )
    return buildChunkPath(graph.rawInfra, chunks, firstOffset, lastOffset)
}

/**
 * Extends all the given infra explorers until they have the min amount of blocks in lookahead, or
 * they reach the destination. The min number of blocks is arbitrary, it should aim for the required
 * lookahead for proper spacing resource generation. If the value is too low, there would be
 * exceptions thrown, and we would try again with an extended path. If it's too large, we would
 * "fork" too early. Either way the result wouldn't change, it's just a matter of performances.
 */
fun extendLookaheadUntil(input: InfraExplorer, minBlocks: Int): Collection<InfraExplorer> {
    val res = mutableListOf<InfraExplorer>()
    val candidates = mutableListOf(input)
    while (candidates.isNotEmpty()) {
        val candidate = candidates.removeFirst()
        if (
            candidate.getIncrementalPath().pathComplete ||
                candidate.getLookahead().size >= minBlocks
        )
            res.add(candidate)
        else candidates.addAll(candidate.cloneAndExtendLookahead())
    }
    return res
}
