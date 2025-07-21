package fr.sncf.osrd.stdcm.graph

import fr.sncf.osrd.api.FullInfra
import fr.sncf.osrd.envelope.Envelope
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue
import fr.sncf.osrd.envelope_sim.allowances.AllowanceValue.FixedTime
import fr.sncf.osrd.graph.Graph
import fr.sncf.osrd.railjson.schema.rollingstock.Comfort
import fr.sncf.osrd.sim_infra.impl.TemporarySpeedLimitManager
import fr.sncf.osrd.stdcm.STDCMAStarHeuristic
import fr.sncf.osrd.stdcm.STDCMHeuristicBuilder
import fr.sncf.osrd.stdcm.STDCMStep
import fr.sncf.osrd.stdcm.graph.engineering_allowance.EngineeringAllowanceManager
import fr.sncf.osrd.stdcm.graph.visited_node_tracking.VisitedNodes
import fr.sncf.osrd.stdcm.infra_exploration.InfraExplorerWithEnvelope
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface
import fr.sncf.osrd.train.RollingStock
import fr.sncf.osrd.utils.CachedBlockMRSPBuilder
import fr.sncf.osrd.utils.units.meters
import java.lang.Double.isFinite
import java.lang.Double.isNaN
import kotlin.math.max
import kotlin.math.min

/**
 * This is the class that encodes the STDCM problem as a graph on which we can run our pathfinding
 * implementation. Most of the logic has been delegated to helper classes in this module:
 * AllowanceManager handles adding delays using allowances, BacktrackingManager handles backtracking
 * to fix speed discontinuities, DelayManager handles how much delay we can and need to add to avoid
 * conflicts, STDCMEdgeBuilder handles the creation of new STDCMEdge instances
 */
class STDCMGraph(
    val fullInfra: FullInfra,
    val rollingStock: RollingStock,
    val comfort: Comfort?,
    val timeStep: Double,
    blockAvailability: BlockAvailabilityInterface,
    maxRunTime: Double,
    minScheduleTimeStart: Double,
    steps: List<STDCMStep>,
    val tag: String?,
    val standardAllowance: AllowanceValue?,
    val temporarySpeedLimitManager: TemporarySpeedLimitManager = TemporarySpeedLimitManager(),
) : Graph<STDCMNode, STDCMEdge, STDCMEdge> {
    val rawInfra = fullInfra.rawInfra!!
    val blockInfra = fullInfra.blockInfra!!
    var stdcmSimulations: STDCMSimulations = STDCMSimulations()
    val delayManager: DelayManager =
        DelayManager(minScheduleTimeStart, maxRunTime, blockAvailability, this, timeStep)
    val allowanceManager = EngineeringAllowanceManager(rollingStock.constGamma, this)
    val backtrackingManager: BacktrackingManager = BacktrackingManager(this)
    val mrspBuilder =
        CachedBlockMRSPBuilder(rawInfra, blockInfra, rollingStock, temporarySpeedLimitManager)

    // min 30s between two edges, determined empirically
    // TODO: this value *should* reflect twice the min delay between two trains,
    // but it seems we need it to be as small as the smallest amount of time
    // a train can occupy a block. There's an issue somewhere.
    private val visitedNodes = VisitedNodes(30.0, fullInfra, mrspBuilder)

    // A* heuristic
    val remainingTimeEstimator: STDCMAStarHeuristic
    val bestPossibleTime: Double

    /** Constructor */
    init {
        assert(standardAllowance !is FixedTime) {
            "Standard allowance cannot be a flat time for STDCM trains"
        }
        remainingTimeEstimator =
            STDCMHeuristicBuilder(
                    fullInfra.blockInfra,
                    fullInfra.rawInfra,
                    steps,
                    maxRunTime,
                    rollingStock,
                    temporarySpeedLimitManager,
                    mrspBuilder,
                )
                .build()
        bestPossibleTime = remainingTimeEstimator.bestTravelTime
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
        val maxMarginDuration = estimateMaxMarginDuration(node)
        var visitedNodesParameters =
            VisitedNodes.Parameters(
                null,
                node.timeData,
                maxMarginDuration,
                node.remainingTimeEstimation,
                explorer = node.infraExplorer
            )
        if (node.locationOnEdge != null) {
            val explorer = node.infraExplorer.clone()
            visitedNodesParameters.fingerprint =
                VisitedNodes.Fingerprint(
                    explorer.getLastEdgeIdentifier(),
                    node.infraExplorer.getStepTracker().nStepsExcludingLookahead,
                    node.locationOnEdge.distance
                )
            if (visitedNodes.isVisited(visitedNodesParameters)) return listOf()
            visitedNodes.markAsVisited(visitedNodesParameters)
            res.addAll(STDCMEdgeBuilder.fromNode(this, node, explorer).makeAllEdges())
        } else {
            val extended = extendLookaheadUntil(node.infraExplorer.clone(), 3)
            for (newPath in extended) {
                if (newPath.getLookahead().size == 0) continue
                newPath.moveForward()
                visitedNodesParameters.fingerprint =
                    VisitedNodes.Fingerprint(
                        newPath.getLastEdgeIdentifier(),
                        node.infraExplorer.getStepTracker().nStepsExcludingLookahead,
                        0.meters
                    )
                visitedNodesParameters = visitedNodesParameters.copy(explorer = newPath)
                if (visitedNodes.isVisited(visitedNodesParameters)) continue
                visitedNodes.markAsVisited(visitedNodesParameters)
                res.addAll(
                    STDCMEdgeBuilder.fromNode(this, node, newPath as InfraExplorerWithEnvelope)
                        .makeAllEdges()
                )
            }
        }
        return res
    }

    /**
     * Give a (rough) estimation of how much delay we could add before this node with engineering
     * margins. Should be on the pessimistic side.
     */
    private fun estimateMaxMarginDuration(inputNode: STDCMNode): Double {
        // We look for the 20km before the node (very rough estimation of a distance that lets the
        // train slow down to a stop and speed up). We return the max delay that can be added after
        // the train in all of those edges, on top of maximum start time delay

        // TODO: use new EngineeringAllowanceManager?
        // We'd need to use a const acceleration sim, and we may add some caching

        var node = inputNode
        var remainingDistance = 20_000.meters
        var maxTime = Double.POSITIVE_INFINITY
        while (true) {
            val edge = node.previousEdge ?: return maxTime

            val latestTimeWithMaxShift =
                edge.timeData.earliestReachableTime +
                    edge.totalTime +
                    edge.timeData.maxDepartureDelayingWithoutConflict

            // Only consider this specific edge, not the rest of the path
            val maxDelayAddedOnEdge =
                max(0.0, edge.timeData.timeOfNextConflictAtLocation - latestTimeWithMaxShift)
            maxTime = min(maxTime, maxDelayAddedOnEdge)

            remainingDistance -= edge.length.distance
            if (edge.beginSpeed == 0.0 || remainingDistance <= 0.meters) return maxTime

            node = edge.previousNode
        }
    }
}

val goodBlocks =
    setOf(
        21860, 2621, 17584, 15122, 15123, 15124, 15125, 15126, 53365, 26079, 26080, 26081, 44188, 26261, 26262, 26263, 16645, 42880, 52318, 11653, 11654, 11655, 11656, 27345, 28653, 19063, 10389, 10390, 10391, 9169, 9170, 9171, 50185, 50186, 55760, 50939, 22330, 52758, 9861, 3167, 3168, 52241, 29490, 2842, 31898, 31899, 31900, 341, 47062, 47063, 47064, 47065, 47066, 54705, 32014, 42897, 32215, 38281, 24549, 24550, 14714, 14715, 4844, 4845, 13197, 1015, 45078, 17412, 20424, 20425, 20426, 20427, 22865, 6756, 36014, 36015, 36016, 36100, 52319, 38871, 38872, 38873, 38874, 12092, 7431, 1146, 1147, 1148, 54192, 54193, 54194, 54195, 54196, 34783, 34784, 34785, 34786, 7384, 27675, 30060, 575, 576, 50083, 18510, 1944, 1945, 18328, 42422, 42423, 1971, 1972, 49777, 49778, 49779, 50120, 52946, 45868, 45869, 45870, 32466, 32467, 32468, 17625, 17626, 17627, 17628, 49547, 49548, 49549, 36167, 21563, 53295, 27049, 26866, 18741, 52568, 52569, 52570, 52571, 23040, 22361, 21499, 21500, 21501, 21502, 12178, 12179, 12180, 37058, 54419, 4805, 42755, 42756, 42757, 42758, 42759, 42760, 42761, 19868, 19869, 55905, 38876, 7897, 52482, 36004, 54182, 31320, 7504, 7505, 7506, 33349, 33350, 33351, 33352, 55126, 46976, 46977, 10316, 6246, 46083, 55884, 14539, 14540, 39591, 2952, 2953, 2954, 2955, 31423, 47374, 1282, 1283, 1284, 1285, 1286, 47732, 14303, 19662, 24444, 18819, 26385, 2418, 793, 8498, 8499, 8500, 8501, 8502, 1036, 31000, 31001, 31002, 34628, 34629, 34630, 34631, 34632, 26556, 41439, 41440, 41441, 41442, 14684, 55479, 40541, 44841, 44842, 44843, 44844, 13745, 13746, 39737, 31027, 53456, 15542, 34364, 31711, 31712, 31713, 31714, 10408, 10409, 10410, 10411, 10029, 23718, 23719, 42120, 31458, 13475, 51180, 51181, 51182, 51183, 7938, 7939, 24960, 113, 114, 115, 15778, 7840, 7841, 7842, 7843, 7658, 7659, 7660, 7661, 29694, 54941, 34756, 34757, 34758, 53043, 53044, 53045, 53046, 53047, 50649, 17909, 17910, 24453, 5408, 21680, 21681, 21682, 21683, 21684, 38276, 27141, 24259, 2158, 2159, 2160, 243, 244, 245, 246, 37178, 28311, 35752, 45416, 45417, 45418, 45419, 22400, 52221
    )
