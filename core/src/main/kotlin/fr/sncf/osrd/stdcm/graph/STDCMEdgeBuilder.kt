package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.isTimeStrictlyPositive
import fr.sncf.osrd.envelope_sim.allowances.LinearAllowance
import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.standalone_sim.EnvelopeStopWrapper
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.TrainStop
import fr.sncf.osrd.utils.units.Distance.Companion.fromMeters
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters
import kotlin.math.min

/** This class handles the creation of new edges, handling the many optional parameters. */
data class STDCMEdgeBuilder
internal constructor(
    /** Instance used to explore the infra, contains the underlying edge */
    private val infraExplorer: InfraExplorerWithEnvelope,
    /** STDCM Graph, needed for most operations */
    private val graph: STDCMGraph,
    /** Previous node, used to compute the final path */
    private var prevNode: STDCMNode,
    /** Start time of the edge */
    private var startTime: Double = 0.0,

    /** Start speed, ignored if envelope is specified */
    private var startSpeed: Double = 0.0,

    /** Start offset on the given block */
    private var startOffset: Offset<Block> = Offset(0.meters),

    /**
     * Maximum delay we can add on any of the previous edges by shifting the departure time, without
     * causing a conflict
     */
    private var prevMaximumAddedDelay: Double = 0.0,

    /**
     * Sum of all the delay that has been added in the previous edges by shifting the departure time
     */
    private var prevAddedDelay: Double = 0.0,

    /** Envelope to use on the edge, if unspecified we try to go at maximum allowed speed */
    private var envelope: Envelope? = null,

    /**
     * Infra explorer with the new envelope for the current edge. Keeping one instance is important
     * for the resource generator caches. This is the instance that must be used for next edges
     */
    private var explorerWithNewEnvelope: InfraExplorerWithEnvelope? = null,

    /** Index of the last waypoint passed by the train */
    private var waypointIndex: Int = 0
) {
    // region SETTERS
    /** Sets the start time of the edge */
    fun setStartTime(startTime: Double): STDCMEdgeBuilder {
        this.startTime = startTime
        return this
    }

    /** Sets the start speed, ignored if the envelope has been specified */
    fun setStartSpeed(startSpeed: Double): STDCMEdgeBuilder {
        this.startSpeed = startSpeed
        return this
    }

    /** Start offset on the given block */
    fun setStartOffset(startOffset: Offset<Block>): STDCMEdgeBuilder {
        this.startOffset = startOffset
        return this
    }

    /**
     * Sets the maximum delay we can add on any of the previous edges by shifting the departure time
     */
    fun setPrevMaximumAddedDelay(prevMaximumAddedDelay: Double): STDCMEdgeBuilder {
        this.prevMaximumAddedDelay = prevMaximumAddedDelay
        return this
    }

    /**
     * Sets the sum of all the delay that has been added in the previous edges by shifting the
     * departure time
     */
    fun setPrevAddedDelay(prevAddedDelay: Double): STDCMEdgeBuilder {
        this.prevAddedDelay = prevAddedDelay
        return this
    }

    /**
     * Sets the envelope to use on the edge, if unspecified we try to go at maximum allowed speed
     */
    fun setEnvelope(envelope: Envelope?): STDCMEdgeBuilder {
        this.envelope = envelope
        return this
    }

    /**
     * Sets the waypoint index on the new edge (i.e. the index of the last waypoint passed by the
     * train)
     */
    fun setWaypointIndex(waypointIndex: Int): STDCMEdgeBuilder {
        this.waypointIndex = waypointIndex
        return this
    }
    // endregion SETTERS
    // region BUILDERS
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
                .filter { x: Double -> startTime + x <= timeNextOccupancy }
                .max { obj: Double, anotherDouble: Double? -> obj.compareTo(anotherDouble!!) }
        return delay.map { delayNeeded: Double -> makeSingleEdge(delayNeeded) }.orElse(null)
    }
    // endregion BUILDERS
    // region UTILITIES
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
                        startSpeed,
                        startOffset,
                        getStopOnBlock(
                            graph,
                            infraExplorer.getCurrentBlock(),
                            startOffset,
                            waypointIndex
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
            val envelopeWithStop =
                if (stopDuration == null) scaledEnvelope
                else
                    EnvelopeStopWrapper(
                        scaledEnvelope,
                        listOf(
                            TrainStop(
                                envelope.endPos,
                                stopDuration,
                                // TODO: forward and use onStopSignal param from request
                                isTimeStrictlyPositive(stopDuration)
                            )
                        )
                    )
            explorerWithNewEnvelope = infraExplorer.clone().addEnvelope(envelopeWithStop)
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
            startTime,
            envelope!!,
            startOffset,
        )
    }

    /** Returns the stop duration at the end of the edge being built, or null if there's no stop */
    private fun getEndStopDuration(): Double? {
        val endAtStop =
            getStopOnBlock(graph, infraExplorer.getCurrentBlock(), startOffset, waypointIndex) !=
                null
        if (!endAtStop) return null
        return graph.getFirstStopAfterIndex(waypointIndex)!!.duration!!
    }

    /** Creates a single STDCM edge, adding the given amount of delay */
    private fun makeSingleEdge(delayNeeded: Double): STDCMEdge? {
        if (java.lang.Double.isInfinite(delayNeeded)) return null
        val actualStartTime = startTime + delayNeeded

        var maximumDelay = 0.0
        var departureTimeShift = delayNeeded
        if (delayNeeded > prevMaximumAddedDelay) {
            // We can't just shift the departure time, we need an engineering allowance
            // It's not computed yet, we just check that it's possible
            if (!graph.allowanceManager.checkEngineeringAllowance(prevNode, actualStartTime))
                return null
            // We still need to adapt the delay values
            departureTimeShift = prevMaximumAddedDelay
        } else {
            maximumDelay =
                min(
                    prevMaximumAddedDelay - delayNeeded,
                    graph.delayManager.findMaximumAddedDelay(
                        getExplorerWithNewEnvelope()!!,
                        startTime + delayNeeded,
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
                infraExplorer,
                getExplorerWithNewEnvelope()!!,
                actualStartTime,
                maximumDelay,
                departureTimeShift,
                graph.delayManager.findNextOccupancy(
                    getExplorerWithNewEnvelope()!!,
                    startTime + delayNeeded,
                    startOffset,
                    envelope!!,
                ),
                prevAddedDelay + departureTimeShift,
                prevNode,
                startOffset,
                waypointIndex,
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
    } // endregion UTILITIES

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
