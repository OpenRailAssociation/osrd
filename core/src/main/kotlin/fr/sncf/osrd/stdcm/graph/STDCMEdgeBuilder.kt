package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.infra.api.signaling.SignalingRoute
import kotlin.math.min

/** This class handles the creation of new edges, handling the many optional parameters.  */
class STDCMEdgeBuilder
internal constructor(
    /** Route considered for the new edge(s)  */
    private val route: SignalingRoute,
    /** STDCM Graph, needed for most operations  */
    private val graph: STDCMGraph
) {
    /** Start time of the edge  */
    private var startTime = 0.0

    /** Start speed, ignored if envelope is specified  */
    private var startSpeed = 0.0

    /** Start offset on the given route  */
    private var startOffset = 0.0

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

    /** Start offset on the given route  */
    fun setStartOffset(startOffset: Double): STDCMEdgeBuilder {
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
    fun setEnvelope(envelope: Envelope): STDCMEdgeBuilder {
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
    /** Creates all edges that can be accessed on the given route, using all the parameters specified.  */
    fun makeAllEdges(): Collection<STDCMEdge> {
        if (envelope == null)
            envelope = STDCMSimulations.simulateRoute(
                route,
                startSpeed,
                startOffset,
                graph.rollingStock,
                graph.comfort,
                graph.timeStep,
                STDCMUtils.getStopOnRoute(graph, route, startOffset, waypointIndex),
                graph.tag
            )
        if (envelope == null)
            return listOf()
        val delaysPerOpening: Set<Double> = if (forceMaxDelay)
            findMaxDelay()
        else
            graph.delayManager.minimumDelaysPerOpening(
                route, startTime, envelope!!, startOffset
            )
        val res = ArrayList<STDCMEdge>()
        for (delayNeeded in delaysPerOpening) {
            val newEdge = makeSingleEdge(delayNeeded)
            if (newEdge != null)
                res.add(newEdge)
        }
        return res
    }

    /** Finds the maximum amount of delay that can be added by simply shifting the departure time
     * (no engineering allowance)  */
    private fun findMaxDelay(): Set<Double> {
        val allDelays = graph.delayManager.minimumDelaysPerOpening(route, startTime, envelope!!, startOffset)
        val lastOpeningDelay = allDelays.floor(prevMaximumAddedDelay) ?: return setOf()
        return setOf(
            min(
                prevMaximumAddedDelay,
                lastOpeningDelay + graph.delayManager.findMaximumAddedDelay(
                    route,
                    startTime + lastOpeningDelay,
                    startOffset,
                    envelope!!
                )
            )
        )
    }

    /** Creates a single STDCM edge, adding the given amount of delay  */
    private fun makeSingleEdge(delayNeeded: Double): STDCMEdge? {
        if (java.lang.Double.isInfinite(delayNeeded)) return null
        val maximumDelay = min(
            prevMaximumAddedDelay - delayNeeded,
            graph.delayManager.findMaximumAddedDelay(route, startTime + delayNeeded, startOffset, envelope!!)
        )
        val actualStartTime = startTime + delayNeeded
        val endAtStop = STDCMUtils.getStopOnRoute(graph, route, startOffset, waypointIndex) != null
        var res: STDCMEdge? = STDCMEdge(
            route,
            envelope!!,
            actualStartTime,
            maximumDelay,
            delayNeeded,
            graph.delayManager.findNextOccupancy(route, startTime + delayNeeded, startOffset, envelope!!),
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
        if (res == null || graph.delayManager.isRunTimeTooLong(res))
            return null
        return res
    }

    /** Creates all the edges in the given settings, then look for one that shares the given time of next occupancy.
     * This is used to identify the "openings" between two occupancies,
     * it is used to ensure we use the same one when re-building edges.  */
    fun findEdgeSameNextOccupancy(timeNextOccupancy: Double): STDCMEdge? {
        val newEdges = makeAllEdges()
        // We look for an edge that uses the same opening, identified by the next occupancy
        for (newEdge in newEdges) {
            // The time of next occupancy is always copied from the same place, we can use float equality
            if (newEdge.timeNextOccupancy == timeNextOccupancy)
                return newEdge
        }
        return null // No result was found
    }

    companion object {
        @JvmStatic
        fun fromNode(graph: STDCMGraph, node: STDCMNode, route: SignalingRoute): STDCMEdgeBuilder {
            val builder = STDCMEdgeBuilder(route, graph)
            if (node.locationOnRoute != null) {
                assert(route == node.locationOnRoute.edge)
                builder.startOffset = node.locationOnRoute.offset
            } else
                assert(route.infraRoute.entryDetector == node.detector)
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
