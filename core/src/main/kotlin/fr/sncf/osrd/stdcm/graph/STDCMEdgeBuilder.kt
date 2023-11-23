package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockId
import fr.sncf.osrd.sim_infra.impl.getBlockEntry
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*
import kotlin.math.min

/** This class handles the creation of new edges, handling the many optional parameters.  */
class STDCMEdgeBuilder // region CONSTRUCTORS
internal constructor(
    /** Block considered for the new edge(s)  */
    private val blockId: BlockId,
    /** STDCM Graph, needed for most operations  */
    private val graph: STDCMGraph
) {
    /** Start time of the edge  */
    private var startTime = 0.0

    /** Start speed, ignored if envelope is specified  */
    private var startSpeed = 0.0

    /** Start offset on the given block  */
    private var startOffset: Offset<Block> = Offset(0.meters)

    /** Maximum delay we can add on any of the previous edges by shifting the departure time,
     * without causing a conflict  */
    private var prevMaximumAddedDelay = 0.0

    /** Sum of all the delay that has been added in the previous edges by shifting the departure time  */
    private var prevAddedDelay = 0.0

    /** Previous node, used to compute the final path  */
    private var prevNode: STDCMNode? = null

    /** Envelope to use on the edge, if unspecified we try to go at maximum allowed speed  */
    private var envelope: Envelope? = null

    /** If set to true, we add the maximum amount of delay allowed by shifting the departure time.
     * Used when computing allowances   */
    private var forceMaxDelay = false

    /** Index of the last waypoint passed by the train  */
    private var waypointIndex = 0
    // endregion CONSTRUCTORS
    // region SETTERS
    /** Sets the start time of the edge  */
    fun setStartTime(startTime: Double): STDCMEdgeBuilder {
        this.startTime = startTime
        return this
    }

    /** Sets the start speed, ignored if the envelope has been specified  */
    fun setStartSpeed(startSpeed: Double): STDCMEdgeBuilder {
        this.startSpeed = startSpeed
        return this
    }

    /** Start offset on the given block  */
    fun setStartOffset(startOffset: Offset<Block>): STDCMEdgeBuilder {
        this.startOffset = startOffset
        return this
    }

    /** Sets the maximum delay we can add on any of the previous edges by shifting the departure time  */
    fun setPrevMaximumAddedDelay(prevMaximumAddedDelay: Double): STDCMEdgeBuilder {
        this.prevMaximumAddedDelay = prevMaximumAddedDelay
        return this
    }

    /** Sets the sum of all the delay that has been added in the previous edges by shifting the departure time  */
    fun setPrevAddedDelay(prevAddedDelay: Double): STDCMEdgeBuilder {
        this.prevAddedDelay = prevAddedDelay
        return this
    }

    /** Sets the previous node, used to compute the final path  */
    fun setPrevNode(prevNode: STDCMNode?): STDCMEdgeBuilder {
        this.prevNode = prevNode
        return this
    }

    /** Sets the envelope to use on the edge, if unspecified we try to go at maximum allowed speed  */
    fun setEnvelope(envelope: Envelope?): STDCMEdgeBuilder {
        this.envelope = envelope
        return this
    }

    /** If set to true, we add the maximum amount of delay allowed by shifting the departure time.
     * Used when computing allowances   */
    fun setForceMaxDelay(forceMaxDelay: Boolean): STDCMEdgeBuilder {
        this.forceMaxDelay = forceMaxDelay
        return this
    }

    /** Sets the waypoint index on the new edge (i.e. the index of the last waypoint passed by the train)  */
    fun setWaypointIndex(waypointIndex: Int): STDCMEdgeBuilder {
        this.waypointIndex = waypointIndex
        return this
    }
    // endregion SETTERS
    // region BUILDERS
    /** Creates all edges that can be accessed on the given block, using all the parameters specified.  */
    @Suppress("UNCHECKED_CAST")
    fun makeAllEdges(): Collection<STDCMEdge> {
        if (hasDuplicateBlocks())
            return listOf()
        return if (getEnvelope() == null)
            listOf()
        else
            delaysPerOpening.stream()
                .map { delayNeeded -> makeSingleEdge(delayNeeded) }
                .filter { obj -> Objects.nonNull(obj) }
                .toList() as Collection<STDCMEdge>
    }

    /** Creates all the edges in the given settings, then look for one that shares the given time of next occupancy.
     * This is used to identify the "openings" between two occupancies,
     * it is used to ensure we use the same one when re-building edges.  */
    fun findEdgeSameNextOccupancy(timeNextOccupancy: Double): STDCMEdge? {
        // We look for an edge that uses the same opening, identified by the next occupancy
        if (getEnvelope() == null)
            return null
        // We look for the last possible delay that would start before the expected time of next occupancy
        val delay = delaysPerOpening.stream()
            .filter { x: Double -> startTime + x <= timeNextOccupancy }
            .max { obj: Double, anotherDouble: Double? -> obj.compareTo(anotherDouble!!) }
        return delay.map { delayNeeded: Double -> makeSingleEdge(delayNeeded) }.orElse(null)
    }
    // endregion BUILDERS
    // region UTILITIES
    /** Returns the envelope to be used for the new edges  */
    private fun getEnvelope(): Envelope? {
        if (envelope == null)
            envelope = graph.stdcmSimulations.simulateBlock(
                graph.rawInfra,
                graph.blockInfra,
                graph.rollingStock,
                graph.comfort,
                graph.timeStep,
                graph.tag,
                BlockSimulationParameters(
                    blockId, startSpeed, startOffset,
                    getStopOnBlock(graph, blockId, startOffset, waypointIndex)
                )
            )
        return envelope
    }

    private val delaysPerOpening: Set<Double>
        /** Returns the set of delays to use to reach each opening.
         * If the flag `forceMaxDelay` is set, returns the maximum delay that can be used without allowance.  */
        get() = if (forceMaxDelay)
            findMaxDelay()
        else
            graph.delayManager.minimumDelaysPerOpening(blockId, startTime, envelope!!, startOffset)

    /** Finds the maximum amount of delay that can be added by simply shifting the departure time
     * (no engineering allowance)  */
    private fun findMaxDelay(): Set<Double> {
        val allDelays = graph.delayManager.minimumDelaysPerOpening(blockId, startTime, envelope!!, startOffset)
        val lastOpeningDelay = allDelays.floor(prevMaximumAddedDelay)
            ?: return setOf()
        return mutableSetOf(
            min(
                prevMaximumAddedDelay,
                lastOpeningDelay + graph.delayManager.findMaximumAddedDelay(
                    blockId,
                    startTime + lastOpeningDelay,
                    startOffset,
                    envelope!!
                )
            )
        )
    }

    /** Creates a single STDCM edge, adding the given amount of delay  */
    private fun makeSingleEdge(delayNeeded: Double): STDCMEdge? {
        if (java.lang.Double.isInfinite(delayNeeded))
            return null
        val maximumDelay = min(
            prevMaximumAddedDelay - delayNeeded,
            graph.delayManager.findMaximumAddedDelay(blockId, startTime + delayNeeded, startOffset, envelope!!)
        )
        val actualStartTime = startTime + delayNeeded
        val endAtStop = getStopOnBlock(graph, blockId, startOffset, waypointIndex) != null
        var res: STDCMEdge? = STDCMEdge(
            blockId,
            envelope!!,
            actualStartTime,
            maximumDelay,
            delayNeeded,
            graph.delayManager.findNextOccupancy(blockId, startTime + delayNeeded, startOffset, envelope!!),
            prevAddedDelay + delayNeeded,
            prevNode,
            startOffset, (actualStartTime / 60).toInt(),
            graph.getStandardAllowanceSpeedRatio(envelope!!),
            waypointIndex,
            endAtStop
        )
        if (res!!.maximumAddedDelayAfter < 0)
            res = graph.allowanceManager.tryEngineeringAllowance(res)
        if (res == null)
            return null
        res = graph.backtrackingManager.backtrack(res)
        return if (res == null || graph.delayManager.isRunTimeTooLong(res))
            null
        else
            res
    }

    /** Returns true if the current block is already present in the path to this edge  */
    private fun hasDuplicateBlocks(): Boolean {
        var node = prevNode
        while (node != null) {
            if (!node.previousEdge.endAtStop && node.previousEdge.block == blockId)
                return true
            node = node.previousEdge.previousNode
        }
        return false
    } // endregion UTILITIES

    companion object {
        fun fromNode(graph: STDCMGraph, node: STDCMNode, blockId: BlockId): STDCMEdgeBuilder {
            val builder = STDCMEdgeBuilder(blockId, graph)
            if (node.locationOnBlock != null) {
                assert(blockId == node.locationOnBlock.edge)
                builder.startOffset = node.locationOnBlock.offset
            } else assert(graph.blockInfra.getBlockEntry(graph.rawInfra, blockId) == node.detector)
            builder.startTime = node.time
            builder.startSpeed = node.speed
            builder.prevMaximumAddedDelay = node.maximumAddedDelay
            builder.prevAddedDelay = node.totalPrevAddedDelay
            builder.prevNode = node
            builder.waypointIndex = node.waypointIndex
            return builder
        }
    }
}
