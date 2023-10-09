package fr.sncf.osrd.stdcm.graph;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.POSITION_EPSILON;
import static fr.sncf.osrd.sim_infra.impl.PathPropertiesImplKt.buildChunkPath;
import static fr.sncf.osrd.utils.KtToJavaConverter.toIntList;
import static fr.sncf.osrd.utils.units.Distance.toMeters;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.sim_infra.api.TrackChunk;
import fr.sncf.osrd.sim_infra.impl.ChunkPath;
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
            var sliceUntil = Math.min(envelope.getEndPos(), toMeters(Math.abs(edge.end() - edge.start())));
            if (sliceUntil == 0)
                continue;
            if (Math.abs(sliceUntil - envelope.getEndPos()) < POSITION_EPSILON)
                sliceUntil = envelope.getEndPos(); // The diff between longs and floats can break things here
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
    static Long getStopOnBlock(STDCMGraph graph, int block, long startOffset, int waypointIndex) {
        var res = new ArrayList<Long>();
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

    /** Create a TrainPath instance from a list of edge ranges */
    static ChunkPath makeChunkPathFromRanges(STDCMGraph graph, List<Pathfinding.EdgeRange<STDCMEdge>> ranges) {
        var blocks = ranges.stream()
                .map(range -> range.edge().block())
                .distinct()
                .toList();
        var totalPathLength = ranges.stream()
                .mapToLong(range -> range.end() - range.start())
                .sum();
        var firstOffset = ranges.get(0).edge().envelopeStartOffset() + ranges.get(0).start();
        var lastOffset = firstOffset + totalPathLength;
        var chunks = new MutableDirStaticIdxArrayList<TrackChunk>();
        blocks.stream()
                .flatMap(block -> toIntList(graph.blockInfra.getTrackChunksFromBlock(block)).stream())
                .forEach(chunks::add);
        return buildChunkPath(graph.rawInfra, chunks, firstOffset, lastOffset);
    }
}
