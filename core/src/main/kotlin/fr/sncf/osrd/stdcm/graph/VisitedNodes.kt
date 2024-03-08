package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.stdcm.infra_exploration.EdgeIdentifier
import fr.sncf.osrd.utils.units.Distance

/**
 * This class keeps track of which nodes have already been visited. This is a first filter that
 * isn't meant to replace the checks made by the pathfinding algorithm itself, it just avoids some
 * unnecessary edge instanciation.
 *
 * This class doesn't handle nodes directly, because some edges aren't instantiated from a node.
 *
 * Two nodes are considered "equal" when their `InfraExplorer` instances are equal (which consider
 * the current edge and lookahead), and when their times are close enough. Internally, we have
 * buckets for time frames of (min time distance) length, and we put infra explorer "signatures" in
 * there.
 *
 * the `minDelay` value should be roughly *twice* the minimum time delay between two trains. If it's
 * larger than that, we may consider two scenarios as equal when they are separated by a scheduled
 * train. A smaller value would lead to increased computation time.
 */
data class VisitedNodes(val minDelay: Double) {

    data class Fingerprint(
        val identifier: EdgeIdentifier,
        val waypointIndex: Int,
        val startOffset: Distance
    )

    // We still assume a 24h search space, this may change later on
    private val buckets =
        Array<MutableSet<Fingerprint>>((24 * 3600 / minDelay).toInt()) { mutableSetOf() }

    /** Returns true if the input has already been visited */
    fun isVisited(fingerprint: Fingerprint, time: Double): Boolean {
        val bucket = getBucket(time) ?: return false
        return bucket.contains(fingerprint)
    }

    /** Marks the input as visited */
    fun markAsVisited(fingerprint: Fingerprint, time: Double) {
        getBucket(time)?.add(fingerprint)
    }

    /** Returns the bucket for the given time value */
    private fun getBucket(time: Double): MutableSet<Fingerprint>? {
        val index = (time / minDelay).toInt()
        return if (index < buckets.size) buckets[index] else null
    }
}
