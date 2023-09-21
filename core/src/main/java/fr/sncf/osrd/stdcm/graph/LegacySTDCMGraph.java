package fr.sncf.osrd.stdcm.graph;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.stdcm.LegacySTDCMStep;
import fr.sncf.osrd.stdcm.preprocessing.interfaces.RouteAvailabilityInterface;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Graph;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/** This is the class that encodes the STDCM problem as a graph on which we can run our pathfinding implementation.
 * Most of the logic has been delegated to helper classes in this module:
 * AllowanceManager handles adding delays using allowances,
 * BacktrackingManager handles backtracking to fix speed discontinuities,
 * DelayManager handles how much delay we can and need to add to avoid conflicts,
 * STDCMEdgeBuilder handles the creation of new STDCMEdge instances */
@SuppressFBWarnings({"FE_FLOATING_POINT_EQUALITY"})
public class LegacySTDCMGraph implements Graph<LegacySTDCMNode, LegacySTDCMEdge> {

    public final SignalingInfra infra;
    public final RollingStock rollingStock;
    public final RollingStock.Comfort comfort;
    public final double timeStep;
    final List<LegacySTDCMStep> steps;
    final LegacyDelayManager delayManager;
    final LegacyAllowanceManager allowanceManager;
    final LegacyBacktrackingManager backtrackingManager;
    final String tag;
    final AllowanceValue standardAllowance;

    /** Constructor */
    public LegacySTDCMGraph(
            SignalingInfra infra,
            RollingStock rollingStock,
            RollingStock.Comfort comfort,
            double timeStep,
            RouteAvailabilityInterface routeAvailability,
            double maxRunTime,
            double minScheduleTimeStart,
            List<LegacySTDCMStep> steps,
            String tag,
            AllowanceValue standardAllowance
    ) {
        this.infra = infra;
        this.rollingStock = rollingStock;
        this.comfort = comfort;
        this.timeStep = timeStep;
        this.steps = steps;
        this.delayManager = new LegacyDelayManager(minScheduleTimeStart, maxRunTime, routeAvailability, this);
        this.allowanceManager = new LegacyAllowanceManager(this);
        this.backtrackingManager = new LegacyBacktrackingManager(this);
        this.tag = tag;
        this.standardAllowance = standardAllowance;

        assert !(standardAllowance instanceof AllowanceValue.FixedTime)
                : "Standard allowance cannot be a flat time for STDCM trains";
    }

    /** Returns the speed ratio we need to apply to the envelope to follow the given standard allowance. */
    public double getStandardAllowanceSpeedRatio(
            Envelope envelope
    ) {
        if (standardAllowance == null)
            return 1;

        var runTime = envelope.getTotalTime();
        var distance = envelope.getTotalDistance();
        var allowanceRatio = standardAllowance.getAllowanceRatio(runTime, distance);
        return 1 / (1 + allowanceRatio);
    }

    @Override
    public LegacySTDCMNode getEdgeEnd(LegacySTDCMEdge edge) {
        return edge.getEdgeEnd(this);
    }

    @Override
    public Collection<LegacySTDCMEdge> getAdjacentEdges(LegacySTDCMNode node) {
        if (node.detector() == null)
            return STDCMEdgeBuilder.fromNode(this, node, node.locationOnRoute().edge())
                    .makeAllEdges();
        else {
            var res = new ArrayList<LegacySTDCMEdge>();
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
}
