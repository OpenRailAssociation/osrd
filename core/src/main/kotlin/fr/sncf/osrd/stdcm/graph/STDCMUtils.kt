package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.sim_infra.impl.ChunkPath
import fr.sncf.osrd.sim_infra.impl.buildChunkPath
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset

/** Returns the offset of the next stop (if any) on the current block, starting at startOffset */
fun getNextStopOnCurrentBlock(
    infraExplorer: InfraExplorer,
): Offset<Block>? {
    return infraExplorer
        .getStepTracker()
        .getStepsInLookahead()
        .filter { it.originalStep.stop }
        .filter { it.location.edge == infraExplorer.getCurrentBlock() }
        .map { it.location.offset }
        .minOrNull()
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
