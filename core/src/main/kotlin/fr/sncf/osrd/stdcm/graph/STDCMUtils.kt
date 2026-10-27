package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.LocatedStep
import fr.sncf.osrd.utils.units.Offset

/**
 * Returns the LocatedStep of the next stop (if any) on the current block, starting at startOffset
 */
fun getNextStopOnCurrentBlock(infraExplorer: InfraExplorer, currentBlockId: BlockId): LocatedStep? {
    val step =
        infraExplorer
            .getStepTracker()
            .iterateStepsInLookaheadBackwards()
            .filter { it.location.edge == currentBlockId }
            .lastOrNull { it.originalStep.stop }
    val forcedOpStop =
        infraExplorer
            .getStepTracker()
            .iterateForcedOpStopsInLookaheadBackwards()
            .filter { it.location.edge == currentBlockId }
            .lastOrNull { it.originalStep.stop }
    if (step == null && forcedOpStop == null) return null
    val stepOffset = step?.location?.offset?.meters ?: Double.POSITIVE_INFINITY
    val forcedOpStopOffset = forcedOpStop?.location?.offset?.meters ?: Double.POSITIVE_INFINITY

    val stepDuration = step?.originalStep?.duration ?: Double.POSITIVE_INFINITY
    val forcedOpStopDuration = forcedOpStop?.originalStep?.duration ?: Double.POSITIVE_INFINITY

    return when {
        stepOffset < forcedOpStopOffset -> step
        forcedOpStopOffset < stepOffset -> forcedOpStop
        stepDuration < forcedOpStopDuration -> forcedOpStop
        else -> step
    }
}

/** Returns the offset of the next stop (if any) on the current block, starting at startOffset */
fun getNextStopOffsetOnCurrentBlock(infraExplorer: InfraExplorer): Offset<Block>? {
    return getNextStopOnCurrentBlock(infraExplorer, infraExplorer.getCurrentBlock())
        ?.location
        ?.offset
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
        if (candidate.isPathComplete || candidate.getLookahead().size >= minBlocks)
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
    if (filteredIndices.isEmpty()) {
        // Should not be valid, but happens in tests
        return Pair(true, null)
    }
    val index = filteredIndices[0]
    if (index > 0 && index < input.size - 1) {
        return Pair(false, null)
    }
    return Pair(true, index)
}
