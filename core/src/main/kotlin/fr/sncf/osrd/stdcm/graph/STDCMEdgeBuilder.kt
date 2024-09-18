package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.math.min

/** This class handles the creation of new edges, handling the many optional parameters. */
@ConsistentCopyVisibility
data class STDCMEdgeBuilder
internal constructor(
    /** Instance used to explore the infra, contains the underlying edge */
    private val infraExplorer: InfraExplorerWithEnvelope,
    /** STDCM Graph, needed for most operations */
    private val graph: STDCMGraph,
    /** Previous node, used to compute the final path */
    private var prevNode: STDCMNode,
    /** Start offset on the given block */
    private var startOffset: Offset<Block> = Offset(0.meters),
    /** Envelope to use on the edge, if unspecified we try to go at maximum allowed speed */
    private var envelope: Envelope? = null,

    /**
     * Infra explorer with the new envelope for the current edge. Keeping one instance is important
     * for the resource generator caches. This is the instance that must be used for next edges
     */
    private var explorerWithNewEnvelope: InfraExplorerWithEnvelope? = null,
) {
    /**
     * Sets the envelope to use on the edge, if unspecified we try to go at maximum allowed speed
     */
    fun setEnvelope(envelope: Envelope?): STDCMEdgeBuilder {
        this.envelope = envelope
        return this
    }

    /**
     * Creates all edges that can be accessed on the given block, using all the parameters
     * specified.
     */
    fun makeAllEdges(): Collection<STDCMEdge> {
        return try {
            if (getEnvelope() == null || hasDuplicateBlocks()) {
                listOf()
            } else {
                val delays = getDelaysPerOpening()
                val edges = delays.mapNotNull { delayNeeded -> makeSingleEdge(delayNeeded) }
                edges
            }
        } catch (_: BlockAvailabilityInterface.NotEnoughLookaheadError) {
            // More lookahead required, extend and repeat for each new path
            return infraExplorer.cloneAndExtendLookahead().flatMap {
                copy(infraExplorer = it, explorerWithNewEnvelope = null).makeAllEdges()
            }
        }
    }

    /**
     * Creates all the edges in the given settings, then look for one that shares the given time of
     * next occupancy. This is used to identify the "openings" between two occupancies, it is used
     * to ensure we use the same one when re-building edges.
     */
    fun findEdgeSameNextOccupancy(timeNextOccupancy: Double): STDCMEdge? {
        // We look for an edge that uses the same opening, identified by the next occupancy
        if (getEnvelope() == null) return null
        // We look for the last possible delay that would start before the expected time of next
        // occupancy
        val delay =
            getDelaysPerOpening()
                .stream()
                .filter { x: Double ->
                    prevNode.timeData.earliestReachableTime + x <= timeNextOccupancy
                }
                .max { obj: Double, anotherDouble: Double? -> obj.compareTo(anotherDouble!!) }
        return delay.map { delayNeeded: Double -> makeSingleEdge(delayNeeded) }.orElse(null)
    }
    /** Returns the envelope to be used for the new edges */
    private fun getEnvelope(): Envelope? {
        if (envelope == null)
            envelope =
                graph.stdcmSimulations.simulateBlock(
                    graph.rawInfra,
                    graph.rollingStock,
                    graph.comfort,
                    graph.timeStep,
                    graph.tag,
                    infraExplorer,
                    BlockSimulationParameters(
                        infraExplorer.getCurrentBlock(),
                        prevNode.speed,
                        startOffset,
                        getStopOnBlock(
                            graph,
                            infraExplorer.getCurrentBlock(),
                            startOffset,
                            prevNode.waypointIndex
                        )
                    )
                )
        return envelope
    }

    /**
     * Returns the (single) explorer with the envelope of the current edge, instantiating it if
     * needed.
     */
    private fun getExplorerWithNewEnvelope(): InfraExplorerWithEnvelope? {
        if (explorerWithNewEnvelope == null) {
            val envelope = getEnvelope() ?: return null
            val speedRatio = graph.getStandardAllowanceSpeedRatio(envelope)
            val scaledEnvelope =
                if (envelope.endPos == 0.0) envelope
                else LinearAllowance.scaleEnvelope(envelope, speedRatio)
            val stopDuration = getEndStopDuration()
            explorerWithNewEnvelope = infraExplorer.clone().addEnvelope(scaledEnvelope)
            if (stopDuration != null) explorerWithNewEnvelope!!.addStop(stopDuration)
        }
        return explorerWithNewEnvelope
    }

    /**
     * Returns the set of delays to use to reach each opening. If the flag `forceMaxDelay` is set,
     * returns the maximum delay that can be used without allowance.
     */
    private fun getDelaysPerOpening(): Set<Double> {
        return graph.delayManager.minimumDelaysPerOpening(
            getExplorerWithNewEnvelope()!!,
            prevNode.timeData.earliestReachableTime,
            envelope!!,
            startOffset,
        )
    }

    /** Returns the stop duration at the end of the edge being built, or null if there's no stop */
    private fun getEndStopDuration(): Double? {
        val endAtStop =
            getStopOnBlock(
                graph,
                infraExplorer.getCurrentBlock(),
                startOffset,
                prevNode.waypointIndex
            ) != null
        if (!endAtStop) return null
        return graph.getFirstStopAfterIndex(prevNode.waypointIndex)!!.duration!!
    }

    /** Creates a single STDCM edge, adding the given amount of delay */
    private fun makeSingleEdge(delayNeeded: Double): STDCMEdge? {
        if (java.lang.Double.isInfinite(delayNeeded)) return null
        val actualStartTime = prevNode.timeData.earliestReachableTime + delayNeeded

        var maximumDelay = 0.0
        var departureTimeShift = delayNeeded
        if (delayNeeded > prevNode.timeData.maxDepartureDelayingWithoutConflict) {
            // We can't just shift the departure time, we need an engineering allowance
            // It's not computed yet, we just check that it's possible
            if (!graph.allowanceManager.checkEngineeringAllowance(prevNode, actualStartTime))
                return null
            // We still need to adapt the delay values
            departureTimeShift = prevNode.timeData.maxDepartureDelayingWithoutConflict
        } else {
            maximumDelay =
                min(
                    prevNode.timeData.maxDepartureDelayingWithoutConflict - delayNeeded,
                    graph.delayManager.findMaximumAddedDelay(
                        getExplorerWithNewEnvelope()!!,
                        prevNode.timeData.earliestReachableTime + delayNeeded,
                        startOffset,
                        envelope!!,
                    )
                )
        }
        val endStopDuration = getEndStopDuration()
        val endAtStop = endStopDuration != null
        val standardAllowanceSpeedRatio = graph.getStandardAllowanceSpeedRatio(envelope!!)
        var res: STDCMEdge? =
            STDCMEdge(
                prevNode.timeData.shifted(
                    timeShift = delayNeeded,
                    delayAddedToLastDeparture = departureTimeShift,
                    timeOfNextConflictAtLocation =
                        graph.delayManager.findNextOccupancy(
                            getExplorerWithNewEnvelope()!!,
                            prevNode.timeData.earliestReachableTime + delayNeeded,
                            startOffset,
                            envelope!!,
                        ),
                    maxDepartureDelayingWithoutConflict = maximumDelay,
                ),
                infraExplorer,
                getExplorerWithNewEnvelope()!!,
                prevNode,
                startOffset,
                prevNode.waypointIndex,
                endAtStop,
                envelope!!.beginSpeed,
                envelope!!.endSpeed,
                Length(fromMeters(envelope!!.endPos)),
                envelope!!.totalTime / standardAllowanceSpeedRatio,
            )
        res = graph.backtrackingManager.backtrack(res!!, envelope!!)
        return if (res == null || graph.delayManager.isRunTimeTooLong(res)) null else res
    }

    /** Returns true if the current block is already present in the path to this edge */
    private fun hasDuplicateBlocks(): Boolean {
        var node = prevNode
        while (true) {
            val prevEdge = node.previousEdge ?: return false
            if (!prevEdge.endAtStop && prevEdge.block == infraExplorer.getCurrentBlock())
                return true
            node = prevEdge.previousNode
        }
    }

    companion object {
        fun fromNode(
            graph: STDCMGraph,
            node: STDCMNode,
            infraExplorer: InfraExplorerWithEnvelope
        ): STDCMEdgeBuilder {
            val builder = STDCMEdgeBuilder(infraExplorer, graph, node)
            if (node.locationOnEdge != null) {
                builder.startOffset = node.locationOnEdge
            }
            builder.prevNode = node
            return builder
        }
    }
}
