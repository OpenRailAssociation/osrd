package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorer
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import java.util.*
import kotlin.math.min

/** This class handles the creation of new edges, handling the many optional parameters.  */
class STDCMEdgeBuilder // region CONSTRUCTORS
internal constructor(
    /** Instance used to explore the infra, contains the underlying edge */
    private val infraExplorer: InfraExplorerWithEnvelope,
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
        return if (getEnvelope() == null || hasDuplicateBlocks())
            listOf()
        else
            getDelaysPerOpening().stream()
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
        val delay = getDelaysPerOpening().stream()
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
                graph.rollingStock,
                graph.comfort,
                graph.timeStep,
                graph.tag,
                BlockSimulationParameters(
                    infraExplorer, startSpeed, startOffset,
                    getStopOnBlock(graph, infraExplorer, startOffset, waypointIndex)
                )
            )
        return envelope
    }

    /** Returns the set of delays to use to reach each opening.
     * If the flag `forceMaxDelay` is set, returns the maximum delay that can be used without allowance.  */
    private fun getDelaysPerOpening(): Set<Double> {
        return if (forceMaxDelay)
            findMaxDelay()
        else
            graph.delayManager.minimumDelaysPerOpening(
                infraExplorer, startTime, envelope!!,
                startOffset, getEndStopDuration()
            )
    }

    /** Finds the maximum amount of delay that can be added by simply shifting the departure time
     * (no engineering allowance)  */
    private fun findMaxDelay(): Set<Double> {
        val endStopDuration = getEndStopDuration()
        val allDelays = graph.delayManager.minimumDelaysPerOpening(
            infraExplorer, startTime, envelope!!,
            startOffset, endStopDuration
        )
        val lastOpeningDelay = allDelays.floor(prevMaximumAddedDelay)
            ?: return setOf()
        return mutableSetOf(
            min(
                prevMaximumAddedDelay,
                lastOpeningDelay + graph.delayManager.findMaximumAddedDelay(
                    infraExplorer,
                    startTime + lastOpeningDelay,
                    startOffset,
                    envelope!!,
                    endStopDuration
                )
            )
        )
    }

    /** Returns the stop duration at the end of the edge being built, or null if there's no stop */
    private fun getEndStopDuration(): Double? {
        val endAtStop = getStopOnBlock(graph, infraExplorer, startOffset, waypointIndex) != null
        if (!endAtStop)
            return null
        return graph.steps[waypointIndex + 1].duration!!
    }

    /** Creates a single STDCM edge, adding the given amount of delay  */
    private fun makeSingleEdge(delayNeeded: Double): STDCMEdge? {
        if (java.lang.Double.isInfinite(delayNeeded))
            return null
        val endStopDuration = getEndStopDuration()
        val maximumDelay = min(
            prevMaximumAddedDelay - delayNeeded,
            graph.delayManager.findMaximumAddedDelay(
                infraExplorer, startTime + delayNeeded,
                startOffset, envelope!!, endStopDuration
            )
        )
        val actualStartTime = startTime + delayNeeded
        val endAtStop = endStopDuration != null
        var res: STDCMEdge? = STDCMEdge(
            infraExplorer,
            envelope!!,
            actualStartTime,
            maximumDelay,
            delayNeeded,
            graph.delayManager.findNextOccupancy(
                infraExplorer, startTime + delayNeeded,
                startOffset, envelope!!, endStopDuration
            ),
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
            if (!node.previousEdge.endAtStop && node.previousEdge.block == infraExplorer.getCurrentBlock())
                return true
            node = node.previousEdge.previousNode
        }
        return false
    } // endregion UTILITIES

    companion object {
        fun fromNode(graph: STDCMGraph, node: STDCMNode, infraExplorer: InfraExplorerWithEnvelope): STDCMEdgeBuilder {
            val builder = STDCMEdgeBuilder(infraExplorer, graph)
            if (node.locationOnEdge != null) {
                builder.startOffset = node.locationOnEdge
            }
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
