package fr.sncf.osrd.stdcm.graph

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings
import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue.FixedTime
import fr.sncf.osrd.graph.Graph
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.train.RollingStock.Comfort

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
    minScheduleTimeStart: Double,
    steps: List<STDCMStep>,
    tag: String?,
    standardAllowance: AllowanceValue?
) : Graph<STDCMNode, STDCMEdge, STDCMEdge> {
    val rawInfra = fullInfra.rawInfra!!
    val blockInfra = fullInfra.blockInfra!!
    var stdcmSimulations: STDCMSimulations = STDCMSimulations()
    val steps: List<STDCMStep>
    val delayManager: DelayManager
    val allowanceManager: AllowanceManager
    val backtrackingManager: BacktrackingManager
    val tag: String?
    val standardAllowance: AllowanceValue?

    /** Constructor */
    init {
        this.steps = steps
        delayManager =
            DelayManager(minScheduleTimeStart, maxRunTime, blockAvailability, this, timeStep)
        allowanceManager = AllowanceManager(this)
        backtrackingManager = BacktrackingManager(this)
        this.tag = tag
        this.standardAllowance = standardAllowance
        assert(standardAllowance !is FixedTime) {
            "Standard allowance cannot be a flat time for STDCM trains"
        }
    }

    /**
     * Returns the speed ratio we need to apply to the envelope to follow the given standard
     * allowance.
     */
    fun getStandardAllowanceSpeedRatio(envelope: Envelope): Double {
        if (standardAllowance == null) return 1.0
        val runTime = envelope.totalTime
        val distance = envelope.totalDistance
        val allowanceRatio = standardAllowance.getAllowanceRatio(runTime, distance)
        return 1 / (1 + allowanceRatio)
    }

    override fun getEdgeEnd(edge: STDCMEdge): STDCMNode {
        return edge.getEdgeEnd(this)
    }

    override fun getAdjacentEdges(node: STDCMNode): Collection<STDCMEdge> {
        return if (node.locationOnEdge != null) {
            val explorer = node.infraExplorer.clone()
            explorer.addEnvelope(node.previousEdge.envelope)
            STDCMEdgeBuilder.fromNode(this, node, explorer).makeAllEdges()
        } else {
            val res = ArrayList<STDCMEdge>()
            val extended = extendLookaheadUntil(node.infraExplorer.clone(), 4)
            for (newPath in extended) {
                newPath.addEnvelope(node.previousEdge.envelope)
                newPath.moveForward()
                res.addAll(STDCMEdgeBuilder.fromNode(this, node, newPath).makeAllEdges())
            }
            res
        }
    }

    /**
     * Extends all the given infra explorers until they have the min amount of blocks in lookahead,
     * or they reach the destination. The min number of blocks is arbitrary, it should aim for the
     * required lookahead for proper spacing resource generation. If the value is too low, there
     * would be exceptions thrown and we would try again with an extended path. If it's too large,
     * we would "fork" too early. Either way the result wouldn't change, it's just a matter of
     * performances.
     */
    private fun extendLookaheadUntil(
        input: InfraExplorerWithEnvelope,
        minBlocks: Int
    ): Collection<InfraExplorerWithEnvelope> {
        val res = mutableListOf<InfraExplorerWithEnvelope>()
        val candidates = mutableListOf(input)
        while (candidates.isNotEmpty()) {
            val candidate = candidates.removeFirst()
            if (
                (candidate.getIncrementalPath().pathComplete && candidate.getLookahead().size > 0) ||
                    candidate.getLookahead().size >= minBlocks
            )
                res.add(candidate)
            else candidates.addAll(candidate.cloneAndExtendLookahead())
        }
        return res
    }
}
