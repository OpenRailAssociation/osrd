package fr.sncf.osrd.stdcm.graph;

import static fr.sncf.osrd.sim_infra.api.PathKt.buildPathFrom;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;

import com.google.common.collect.Iterables;
import fr.sncf.osrd.api.pathfinding.PathfindingUtils;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.sim_infra.api.Path;
import fr.sncf.osrd.sim_infra.api.TrackChunk;
import fr.sncf.osrd.utils.graph.Pathfinding;
import fr.sncf.osrd.utils.indexing.MutableDirStaticIdxArrayList;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class STDCMUtils {

    /** Combines all the envelopes in the given edge ranges */
    public static Envelope mergeEnvelopeRanges(
            List<Pathfinding.EdgeRange<STDCMEdge>> edges
    ) {
        var parts = new ArrayList<EnvelopePart>();
        double offset = 0;
        for (var edge : edges) {
            var envelope = edge.edge().envelope();
            var sliceUntil = Math.min(envelope.getEndPos(), Math.abs(edge.end() - edge.start()));
            if (sliceUntil == 0)
                continue;
            var slicedEnvelope = Envelope.make(envelope.slice(0, sliceUntil));
            for (var part : slicedEnvelope)
                parts.add(part.copyAndShift(offset));
            offset = parts.get(parts.size() - 1).getEndPos();
        }
        var newEnvelope = Envelope.make(parts.toArray(new EnvelopePart[0]));
        assert newEnvelope.continuous;
        return newEnvelope;
    }

    /** Combines all the envelopes in the given edges */
    public static Envelope mergeEnvelopes(
            STDCMGraph graph,
            List<STDCMEdge> edges
    ) {
        return mergeEnvelopeRanges(
                edges.stream()
                        .map(e -> new Pathfinding.EdgeRange<>(e, 0, graph.blockInfra.getBlockLength(e.block())))
                        .toList()
        );
    }

    /** Returns the offset of the stops on the given block, starting at startOffset*/
    static Double getStopOnBlock(STDCMGraph graph, int block, double startOffset, int waypointIndex) {
        var res = new ArrayList<Double>();
        while (waypointIndex + 1 < graph.steps.size() && !graph.steps.get(waypointIndex + 1).stop())
            waypointIndex++; // Only the next point where we actually stop matters here
        if (waypointIndex + 1 >= graph.steps.size())
            return null;
        var nextStep = graph.steps.get(waypointIndex + 1);
        if (!nextStep.stop())
            return null;
        for (var endLocation : nextStep.locations()) {
            if (endLocation.edge() == block) {
                var offset = endLocation.offset() - startOffset;
                if (offset >= 0)
                    res.add(offset);
            }
        }
        if (res.isEmpty())
            return null;
        return Collections.min(res);
    }

    /** Builds a train path from a block, offsets from its start, and an envelope. */
    static Path makeTrainPath(STDCMGraph graph, int block, long startOffset, long endOffset) {
        var blockLength = graph.blockInfra.getBlockLength(block);
        assert 0 <= startOffset && startOffset <= blockLength;
        assert 0 <= endOffset && endOffset <= blockLength;
        assert startOffset <= endOffset;
        return PathfindingUtils.makePath(graph.blockInfra, graph.rawInfra, block, startOffset, endOffset);
    }

    /** Create a TrainPath instance from a list of edge ranges */
    static Path makePathFromRanges(STDCMGraph graph, List<Pathfinding.EdgeRange<STDCMEdge>> ranges) {
        var blocks = ranges.stream()
                .map(range -> range.edge().block())
                .toList();
        var totalBlockLength = blocks.stream()
                .mapToLong(graph.blockInfra::getBlockLength)
                .sum();
        var lastRange = ranges.get(ranges.size() - 1);
        var firstOffset = ranges.get(0).edge().envelopeStartOffset() + ranges.get(0).start();
        var lastOffset = totalBlockLength - graph.blockInfra.getBlockLength(Iterables.getLast(blocks))
                + lastRange.edge().envelopeStartOffset() + lastRange.end();
        var chunks = new MutableDirStaticIdxArrayList<TrackChunk>();
        blocks.stream()
                .flatMap(block -> toIntList(graph.blockInfra.getTrackChunksFromBlock(block)).stream())
                .forEach(chunks::add);
        return buildPathFrom(graph.rawInfra, chunks, firstOffset, lastOffset);
    }
}
