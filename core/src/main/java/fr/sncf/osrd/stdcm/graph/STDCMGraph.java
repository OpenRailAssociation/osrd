package fr.sncf.osrd.stdcm.graph;

import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra;
import fr.sncf.osrd.stdcm.STDCMStep;
import fr.sncf.osrd.stdcm.preprocessing.interfaces.BlockAvailabilityInterface;
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
public class STDCMGraph implements Graph<STDCMNode, STDCMEdge> {

    public final RawSignalingInfra rawInfra;
    public final BlockInfra blockInfra;
    public final RollingStock rollingStock;
    public final RollingStock.Comfort comfort;
    public final double timeStep;
    STDCMSimulations stdcmSimulations;
    final List<STDCMStep> steps;
    final DelayManager delayManager;
    final AllowanceManager allowanceManager;
    final BacktrackingManager backtrackingManager;
    final String tag;
    final AllowanceValue performanceAllowance;

    /** Constructor */
    public STDCMGraph(
            RawSignalingInfra rawInfra,
            BlockInfra blockInfra,
            RollingStock rollingStock,
            RollingStock.Comfort comfort,
            double timeStep,
            BlockAvailabilityInterface blockAvailability,
            double maxRunTime,
            double minScheduleTimeStart,
            List<STDCMStep> steps,
            String tag,
            AllowanceValue performanceAllowance
    ) {
        this.rawInfra = rawInfra;
        this.blockInfra = blockInfra;
        this.rollingStock = rollingStock;
        this.comfort = comfort;
        this.timeStep = timeStep;
        this.stdcmSimulations = new STDCMSimulations();
        this.steps = steps;
        this.delayManager = new DelayManager(minScheduleTimeStart, maxRunTime, blockAvailability, this);
        this.allowanceManager = new AllowanceManager(this);
        this.backtrackingManager = new BacktrackingManager(this);
        this.tag = tag;
        this.performanceAllowance = performanceAllowance;

        assert !(performanceAllowance instanceof AllowanceValue.FixedTime)
                : "Performance allowance cannot be a flat time for STDCM trains";
    }

    /** Returns the speed ratio we need to apply to the envelope to follow the given performance allowance. */
    public double getPerformanceAllowanceSpeedRatio(
            Envelope envelope
    ) {
        if (performanceAllowance == null)
            return 1;

        var runTime = envelope.getTotalTime();
        var distance = envelope.getTotalDistance();
        var allowanceRatio = performanceAllowance.getAllowanceRatio(runTime, distance);
        return 1 / (1 + allowanceRatio);
    }

    @Override
    public STDCMNode getEdgeEnd(STDCMEdge edge) {
        return edge.getEdgeEnd(this);
    }

    @Override
    public Collection<STDCMEdge> getAdjacentEdges(STDCMNode node) {
        if (node.detector() == -1)
            return STDCMEdgeBuilder.fromNode(this, node, node.locationOnBlock().edge())
                    .makeAllEdges();
        else {
            var res = new ArrayList<STDCMEdge>();
            var neighbors = blockInfra.getBlocksStartingAtDetector(node.detector());
            for (var neighbor : toIntList(neighbors)) {
                res.addAll(
                        STDCMEdgeBuilder.fromNode(this, node, neighbor)
                                .makeAllEdges()
                );
            }
            return res;
        }
    }
}
