package fr.sncf.osrd.stdcm.graph;

import com.google.common.primitives.Doubles;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
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

    /** Returns the offset of the stops on the given route, starting at startOffset*/
    static double[] getStopsOnRoute(STDCMGraph graph, SignalingRoute route, double startOffset) {
        var res = new ArrayList<Double>();
        for (var endLocation : graph.endLocations) {
            if (endLocation.edge() == route) {
                var offset = endLocation.offset() - startOffset;
                if (offset >= 0)
                    res.add(offset);
            }
        }
        return Doubles.toArray(res);
    }

}
