package fr.sncf.osrd.api.stdcm.graph;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.ArrayList;
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
            List<STDCMEdge> edges
    ) {
        return mergeEnvelopeRanges(
                edges.stream()
                        .map(e -> new Pathfinding.EdgeRange<>(e, 0, e.route().getInfraRoute().getLength()))
                        .toList()
        );
    }
}
