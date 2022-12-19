package fr.sncf.osrd.api.stdcm.graph;

import com.google.common.collect.Multimap;
import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.api.stdcm.OccupancyBlock;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Graph;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Set;

/** This is the class that encodes the STDCM problem as a graph on which we can run our pathfinding implementation.
 * Most of the logic has been delegated to helper classes in this module:
 * AllowanceManager handles adding delays using allowances,
 * BacktrackingManager handles backtracking to fix speed discontinuities,
 * DelayManager handles how much delay we can and need to add to avoid conflicts,
 * STDCMEdgeBuilder handles the creation of new STDCMEdge instances */
@SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
public class STDCMGraph implements Graph<STDCMNode, STDCMEdge> {

    public final SignalingInfra infra;
    public final RollingStock rollingStock;
    public final RollingStock.Comfort comfort;
    public final double timeStep;
    final Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations;
    final DelayManager delayManager;
    final AllowanceManager allowanceManager;
    final BacktrackingManager backtrackingManager;
    final String tag;
    final double standardAllowanceSpeedRatio;

    /** Constructor */
    public STDCMGraph(
            SignalingInfra infra,
            RollingStock rollingStock,
            RollingStock.Comfort comfort,
            double timeStep,
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes,
            double maxRunTime,
            double minScheduleTimeStart,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations,
            String tag,
            AllowanceValue standardAllowance
    ) {
        this.infra = infra;
        this.rollingStock = rollingStock;
        this.comfort = comfort;
        this.timeStep = timeStep;
        this.endLocations = endLocations;
        this.delayManager = new DelayManager(minScheduleTimeStart, maxRunTime, unavailableTimes, this);
        this.allowanceManager = new AllowanceManager(this);
        this.backtrackingManager = new BacktrackingManager(this);
        this.tag = tag;
        this.standardAllowanceSpeedRatio = makeStandardAllowanceSpeedRatio(standardAllowance);
    }

    /** Returns the speed ratio we need to apply to the envelope to apply the given standard allowance */
    private static double makeStandardAllowanceSpeedRatio(AllowanceValue allowanceValue) {
        if (allowanceValue == null)
            return 1;

        // For now only percentage value is supported. Flat time duration can't be supported.
        // Time per distance could eventually be supported as well but the speed factor would be irregular
        assert allowanceValue instanceof AllowanceValue.Percentage
                : "Standard allowance can only be a percentage allowance for STDCM trains";

        var percentAllowance = (AllowanceValue.Percentage) allowanceValue;
        return 1 / (1 + percentAllowance.percentage / 100);
    }

    @Override
    public STDCMNode getEdgeEnd(STDCMEdge edge) {
        return edge.getEdgeEnd(this);
    }

    @Override
    public Collection<STDCMEdge> getAdjacentEdges(STDCMNode node) {
        var res = new ArrayList<STDCMEdge>();
        var neighbors = infra.getSignalingRouteGraph().outEdges(node.detector());
        for (var neighbor : neighbors) {
            res.addAll(
                    STDCMEdgeBuilder.fromNode(this, node, neighbor)
                            .makeAllEdges()
            );
        }
        return res;
    }
}
