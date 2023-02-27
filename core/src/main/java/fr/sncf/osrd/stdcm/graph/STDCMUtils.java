package fr.sncf.osrd.stdcm.graph;

import com.google.common.primitives.Doubles;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
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

    /** Builds a train path from a route, and offset from its start, and an envelope. */
    static TrainPath makeTrainPath(SignalingRoute route, double startOffset, double endOffset) {
        var infraRoute = route.getInfraRoute();
        var start = TrackRangeView.getLocationFromList(infraRoute.getTrackRanges(), startOffset);
        var end = TrackRangeView.getLocationFromList(infraRoute.getTrackRanges(), endOffset);
        return TrainPathBuilder.from(List.of(route), start, end);
    }

    /** Create a TrainPath instance from a list of edge ranges */
    static TrainPath makePathFromRanges(List<Pathfinding.EdgeRange<STDCMEdge>> ranges) {
        var firstEdge = ranges.get(0).edge();
        var lastRange = ranges.get(ranges.size() - 1);
        var lastEdge = lastRange.edge();
        var start = TrackRangeView.getLocationFromList(
                firstEdge.route().getInfraRoute().getTrackRanges(),
                firstEdge.envelopeStartOffset()
        );
        var lastRangeLength = lastRange.end() - lastRange.start();
        var end = TrackRangeView.getLocationFromList(
                lastEdge.route().getInfraRoute().getTrackRanges(),
                lastEdge.envelopeStartOffset() + lastRangeLength
        );
        var routes = ranges.stream()
                .map(range -> range.edge().route())
                .toList();
        return TrainPathBuilder.from(routes, start, end);
    }
}
