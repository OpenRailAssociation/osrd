package fr.sncf.osrd.stdcm.graph

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.FixedTime
import fr.sncf.osrd.graph.Graph
import fr.sncf.osrd.stdcm.STDCMAStarHeuristic
import fr.sncf.osrd.stdcm.STDCMHeuristicBuilder
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.Comfort
import fr.sncf.osrd.utils.units.meters
import java.lang.Double.isFinite
import java.lang.Double.isNaN

/**
 * This is the class that encodes the STDCM problem as a graph on which we can run our pathfinding
 * implementation. Most of the logic has been delegated to helper classes in this module:
 * AllowanceManager handles adding delays using allowances, BacktrackingManager handles backtracking
 * to fix speed discontinuities, DelayManager handles how much delay we can and need to add to avoid
 * conflicts, STDCMEdgeBuilder handles the creation of new STDCMEdge instances
 */
@SuppressFBWarnings("FE_FLOATING_POINT_EQUALITY")
class STDCMGraph(
    val fullInfra: FullInfra,
    val rollingStock: RollingStock,
    val comfort: Comfort?,
    val timeStep: Double,
    blockAvailability: BlockAvailabilityInterface,
    maxRunTime: Double,
    val minScheduleTimeStart: Double,
    steps: List<STDCMStep>,
    tag: String?,
    standardAllowance: AllowanceValue?
) : Graph<STDCMNode, STDCMEdge, STDCMEdge> {
    val rawInfra = fullInfra.rawInfra!!
    val blockInfra = fullInfra.blockInfra!!
    var stdcmSimulations: STDCMSimulations = STDCMSimulations()
    val steps: List<STDCMStep>
    val delayManager: DelayManager
    val allowanceManager: EngineeringAllowanceManager
    val backtrackingManager: BacktrackingManager
    val tag: String?
    val standardAllowance: AllowanceValue?

    // min 4 minutes between two edges, determined empirically
    private val visitedNodes = VisitedNodes(4 * 60.0)

    // A* heuristic
    val remainingTimeEstimator: STDCMAStarHeuristic
    val bestPossibleTime: Double

    /** Constructor */
    init {
        this.steps = steps
        delayManager =
            DelayManager(minScheduleTimeStart, maxRunTime, blockAvailability, this, timeStep)
        allowanceManager = EngineeringAllowanceManager(this)
        backtrackingManager = BacktrackingManager(this)
        this.tag = tag
        this.standardAllowance = standardAllowance
        assert(standardAllowance !is FixedTime) {
            "Standard allowance cannot be a flat time for STDCM trains"
        }
        val heuristicBuilderResult =
            STDCMHeuristicBuilder(
                    fullInfra.blockInfra,
                    fullInfra.rawInfra,
                    steps,
                    maxRunTime,
                    rollingStock
                )
                .build()
        remainingTimeEstimator = heuristicBuilderResult.first
        bestPossibleTime = heuristicBuilderResult.second
    }

    /**
     * Returns the speed ratio we need to apply to the envelope to follow the given standard
     * allowance.
     */
    fun getStandardAllowanceSpeedRatio(envelope: Envelope): Double {
        if (standardAllowance == null || envelope.endPos == 0.0) return 1.0
        val runTime = envelope.totalTime
        val distance = envelope.totalDistance
        val allowanceRatio = standardAllowance.getAllowanceRatio(runTime, distance)
        val res = 1 / (1 + allowanceRatio)
        assert(!isNaN(res) && isFinite(res))
        return res
    }

    override fun getEdgeEnd(edge: STDCMEdge): STDCMNode {
        return edge.getEdgeEnd(this)
    }

    override fun getAdjacentEdges(node: STDCMNode): Collection<STDCMEdge> {
        val res = ArrayList<STDCMEdge>()
        if (node.locationOnEdge != null) {
            val explorer = node.infraExplorer.clone()
            val fingerprint =
                VisitedNodes.Fingerprint(
                    explorer.getLastEdgeIdentifier(),
                    node.waypointIndex,
                    node.locationOnEdge.distance
                )
            if (visitedNodes.isVisited(fingerprint, node.time)) return listOf()
            visitedNodes.markAsVisited(fingerprint, node.time)
            res.addAll(STDCMEdgeBuilder.fromNode(this, node, explorer).makeAllEdges())
        } else {
            val extended = extendLookaheadUntil(node.infraExplorer.clone(), 3)
            for (newPath in extended) {
                if (newPath.getLookahead().size == 0) continue
                newPath.moveForward()
                val fingerprint =
                    VisitedNodes.Fingerprint(
                        newPath.getLastEdgeIdentifier(),
                        node.waypointIndex,
                        0.meters
                    )
                if (visitedNodes.isVisited(fingerprint, node.time)) return listOf()
                visitedNodes.markAsVisited(fingerprint, node.time)
                res.addAll(STDCMEdgeBuilder.fromNode(this, node, newPath).makeAllEdges())
            }
        }
        return res
    }

    /** Returns the first step with a stop after the given index, if any. */
    fun getFirstStopAfterIndex(i: Int): STDCMStep? {
        return steps.withIndex().firstOrNull { it.index > i && it.value.stop }?.value
    }
}
