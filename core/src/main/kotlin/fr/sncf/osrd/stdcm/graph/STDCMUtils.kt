package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.path.implementations.ChunkPath
import fr.sncf.osrd.path.implementations.buildChunkPath
import fr.sncf.osrd.path.interfaces.BlockPath
import fr.sncf.osrd.path.interfaces.TravelledPath
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.withoutConsecutiveDuplicates

/** Returns the offset of the next stop (if any) on the current block, starting at startOffset */
fun getNextStopOnCurrentBlock(infraExplorer: InfraExplorer): Offset<Block>? {
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
    val blocks = edges.map { edge -> edge.block }.withoutConsecutiveDuplicates()
    val totalPathLength =
        Length<TravelledPath>(
            Distance(
                millimeters =
                    edges.stream().mapToLong { edge -> (edge.length.distance).millimeters }.sum()
            )
        )
    val firstOffset = Offset<BlockPath>(edges[0].envelopeStartOffset.distance)
    val lastOffset = firstOffset + totalPathLength.distance
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

/**
 * Checks there is no more than one planned step (non-null element). If there is one, checks it's
 * the departure or arrival. If it's either, returns the corresponding index.
 */
fun <T> checkPlannedStepsAndMaybeIndex(input: List<T>): Pair<Boolean, Int?> {
    val filteredIndices = input.withIndex().filter { (_, item) -> item != null }.map { (i, _) -> i }
    if (filteredIndices.size > 1) {
        return Pair(false, null)
    }
    if (filteredIndices.size == 0) {
        // Should not be valid, but happens in tests
        return Pair(true, null)
    }
    val index = filteredIndices[0]
    if (index > 0 && index < input.size - 1) {
        return Pair(false, null)
    }
    return Pair(true, index)
}
