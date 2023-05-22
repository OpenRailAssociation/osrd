package fr.sncf.osrd.stdcm.graph

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.FixedTime
import fr.sncf.osrd.infra.api.signaling.SignalingInfra
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.graph.STDCMEdgeBuilder.Companion.fromNode
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.Comfort
import fr.sncf.osrd.utils.graph.Graph

/** This is the class that encodes the STDCM problem as a graph on which we can run our pathfinding implementation.
 * Most of the logic has been delegated to helper classes in this module:
 * AllowanceManager handles adding delays using allowances,
 * BacktrackingManager handles backtracking to fix speed discontinuities,
 * DelayManager handles how much delay we can and need to add to avoid conflicts,
 * STDCMEdgeBuilder handles the creation of new STDCMEdge instances  */
@SuppressFBWarnings("FE_FLOATING_POINT_EQUALITY")
class STDCMGraph(
    val infra: SignalingInfra,
    val rollingStock: RollingStock,
    val comfort: Comfort?,
    val timeStep: Double,
    routeAvailability: RouteAvailabilityInterface,
    maxRunTime: Double,
    minScheduleTimeStart: Double,
    val steps: List<STDCMStep>,
    tag: String?,
    standardAllowance: AllowanceValue?
) : Graph<STDCMNode?, STDCMEdge?> {
    val delayManager: DelayManager
    val allowanceManager: AllowanceManager
    val backtrackingManager: BacktrackingManager
    val tag: String?
    val standardAllowance: AllowanceValue?

    /** Constructor  */
    init {
        delayManager = DelayManager(minScheduleTimeStart, maxRunTime, routeAvailability, this)
        allowanceManager = AllowanceManager(this)
        backtrackingManager = BacktrackingManager(this)
        this.tag = tag
        this.standardAllowance = standardAllowance
        assert(standardAllowance !is FixedTime) { "Standard allowance cannot be a flat time for STDCM trains" }
    }

    /** Returns the speed ratio we need to apply to the envelope to follow the given standard allowance.  */
    fun getStandardAllowanceSpeedRatio(
        envelope: Envelope
    ): Double {
        if (standardAllowance == null)
            return 1.0
        val runTime = envelope.totalTime
        val distance = envelope.totalDistance
        val allowanceRatio = standardAllowance.getAllowanceRatio(runTime, distance)
        return 1 / (1 + allowanceRatio)
    }

    override fun getEdgeEnd(edge: STDCMEdge?): STDCMNode {
        edge!!
        return edge.getEdgeEnd(this)
    }

    override fun getAdjacentEdges(node: STDCMNode?): Collection<STDCMEdge> {
        node!!
        if (node.detector == null)
            return fromNode(this, node, node.locationOnRoute!!.edge)
            .makeAllEdges()
        val res = ArrayList<STDCMEdge>()
        val neighbors = infra.signalingRouteGraph.outEdges(node.detector)
        for (neighbor in neighbors) {
            res.addAll(
                fromNode(this, node, neighbor!!)
                    .makeAllEdges()
            )
        }
        return res
    }
}
