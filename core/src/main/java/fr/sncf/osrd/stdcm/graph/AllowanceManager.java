package fr.sncf.osrd.stdcm.graph;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.arePositionsEqual;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.utils.units.Distance;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.List;

/** This class contains all the methods used to handle allowances.
 * This is how we add delays in limited ranges of the path.
 * */
public class AllowanceManager {

    private final STDCMGraph graph;

    public AllowanceManager(STDCMGraph graph) {
        this.graph = graph;
    }

    /** Try to run an engineering allowance on the blocks leading to the given edge. Returns null if it failed. */
    public STDCMEdge tryEngineeringAllowance(
            STDCMEdge oldEdge
    ) {
        var neededDelay = getNeededDelay(oldEdge);
        if (oldEdge.previousNode() == null)
            return null; // The conflict happens on the first block, we can't add delay here
        var affectedEdges = findAffectedEdges(
                oldEdge.previousNode().previousEdge(),
                oldEdge.addedDelay()
        );
        if (affectedEdges.isEmpty())
            return null; // No space to try the allowance
        var context = makeAllowanceContext(affectedEdges);
        var oldEnvelope = STDCMUtils.mergeEnvelopes(graph, affectedEdges);
        var newEnvelope = STDCMSimulations.findEngineeringAllowance(context, oldEnvelope, neededDelay);
        if (newEnvelope == null)
            return null; // We couldn't find an envelope
        var newPreviousEdge = makeNewEdges(affectedEdges, newEnvelope);
        if (newPreviousEdge == null)
            return null; // The new edges are invalid, conflicts shouldn't happen here but it can be too slow
        var newPreviousNode = newPreviousEdge.getEdgeEnd(graph);
        return STDCMEdgeBuilder.fromNode(graph, newPreviousNode, oldEdge.block())
                .findEdgeSameNextOccupancy(oldEdge.timeNextOccupancy());
    }

    /** Computes the delay we need to add */
    private double getNeededDelay(STDCMEdge oldEdge) {
        var neededDelay = -oldEdge.maximumAddedDelayAfter();
        assert neededDelay > 0;
        var targetRunTime = oldEdge.getTotalTime() + neededDelay;

        // As the standard allowance is first applied as a linear allowance over the whole path,
        // we need to compensate it by going faster here
        var targetRunTimePreStandardAllowance = targetRunTime * oldEdge.standardAllowanceSpeedFactor();
        return targetRunTimePreStandardAllowance - oldEdge.envelope().getTotalTime();
    }

    /** Re-create the edges in order, following the given envelope. */
    private STDCMEdge makeNewEdges(List<STDCMEdge> edges, Envelope totalEnvelope) {
        double previousEnd = 0;
        STDCMEdge prevEdge = null;
        if (edges.get(0).previousNode() != null)
            prevEdge = edges.get(0).previousNode().previousEdge();
        for (var edge : edges) {
            double end = previousEnd + edge.envelope().getEndPos();
            end = findClosestPartTransition(end, totalEnvelope);
            var node = prevEdge == null ? null : prevEdge.getEdgeEnd(graph);
            var maxAddedDelayAfter = edge.maximumAddedDelayAfter() + edge.addedDelay();
            if (node != null)
                maxAddedDelayAfter = node.maximumAddedDelay();
            prevEdge = new STDCMEdgeBuilder(edge.block(), graph)
                    .setStartTime(node == null ? edge.timeStart() : node.time())
                    .setStartSpeed(edge.envelope().getBeginSpeed())
                    .setStartOffset(edge.envelopeStartOffset())
                    .setPrevMaximumAddedDelay(maxAddedDelayAfter)
                    .setPrevAddedDelay(node == null ? 0 : node.totalPrevAddedDelay())
                    .setPrevNode(node)
                    .setEnvelope(extractEnvelopeSection(totalEnvelope, previousEnd, end))
                    .setForceMaxDelay(true)
                    .setWaypointIndex(edge.waypointIndex())
                    .findEdgeSameNextOccupancy(edge.timeNextOccupancy());
            if (prevEdge == null)
                return null;
            previousEnd = end;
        }
        assert arePositionsEqual(previousEnd, totalEnvelope.getEndPos());
        return prevEdge;
    }

    /** The position can be an epsilon away from a range transition, which would create an epsilon-length envelope
     * part, which may eventually cause further issues */
    private double findClosestPartTransition(double offset, Envelope envelope) {
        for (var part : envelope) {
            if (arePositionsEqual(offset, part.getBeginPos()))
                return part.getBeginPos();
            if (arePositionsEqual(offset, part.getEndPos()))
                return part.getEndPos();
        }
        return offset;
    }

    /** Returns a new envelope with the content of the base envelope from start to end, with 0 as first position */
    private static Envelope extractEnvelopeSection(Envelope base, double start, double end) {
        var parts = base.slice(start, end);
        for (int i = 0; i < parts.length; i++)
            parts[i] = parts[i].copyAndShift(-start);
        return Envelope.make(parts);
    }

    /** Creates the EnvelopeSimContext to run an allowance on the given edges */
    private EnvelopeSimContext makeAllowanceContext(List<STDCMEdge> edges) {
        var blocks = new ArrayList<Integer>();
        var firstOffset = graph.blockInfra.getBlockLength(edges.get(0).block())
                - Distance.fromMeters(edges.get(0).envelope().getEndPos());
        for (var edge : edges)
            blocks.add(edge.block());
        return STDCMSimulations.makeSimContext(
                graph.rawInfra, graph.blockInfra, blocks, firstOffset,
                graph.rollingStock, graph.comfort, graph.timeStep);
    }

    /** Find on which edges to run the allowance */
    private List<STDCMEdge> findAffectedEdges(STDCMEdge edge, double delayNeeded) {
        var res = new ArrayDeque<STDCMEdge>();
        while (true) {
            if (edge.endAtStop()) {
                // Engineering allowances can't span over stops
                return new ArrayList<>(res);
            }
            var endTime = edge.timeStart() + edge.getTotalTime();
            var maxDelayAddedOnEdge = edge.timeNextOccupancy() - endTime;
            if (delayNeeded > maxDelayAddedOnEdge) {
                // We can't add delay in this block, the allowance range ends here (excluded)
                return new ArrayList<>(res);
            }
            res.addFirst(edge);
            if (edge.previousNode() == null) {
                // We've reached the start of the path, this should only happen because of the max delay parameter
                return new ArrayList<>(res);
            }
            delayNeeded += edge.addedDelay();
            edge = edge.previousNode().previousEdge();
        }
    }
}
