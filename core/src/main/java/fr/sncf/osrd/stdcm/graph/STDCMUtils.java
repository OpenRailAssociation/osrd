package fr.sncf.osrd.stdcm.graph;

import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.POSITION_EPSILON;
import static fr.sncf.osrd.envelope_sim.TrainPhysicsIntegrator.computeAcceleration;

import com.google.common.collect.Iterables;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeDebug;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.utils.graph.Pathfinding;
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
            List<STDCMEdge> edges
    ) {
        return mergeEnvelopeRanges(
                edges.stream()
                        .map(e -> new Pathfinding.EdgeRange<>(e, 0, e.route().getInfraRoute().getLength()))
                        .toList()
        );
    }

    /** Returns the offset of the stops on the given route, starting at startOffset*/
    static Double getStopOnRoute(STDCMGraph graph, SignalingRoute route, double startOffset, int waypointIndex) {
        var res = new ArrayList<Double>();
        while (waypointIndex + 1 < graph.steps.size() && !graph.steps.get(waypointIndex + 1).stop())
            waypointIndex++; // Only the next point where we actually stop matters here
        if (waypointIndex + 1 >= graph.steps.size())
            return null;
        var nextStep = graph.steps.get(waypointIndex + 1);
        if (!nextStep.stop())
            return null;
        for (var endLocation : nextStep.locations()) {
            if (endLocation.edge() == route) {
                var offset = endLocation.offset() - startOffset;
                if (offset >= 0)
                    res.add(offset);
            }
        }
        if (res.isEmpty())
            return null;
        return Collections.min(res);
    }

    /** Builds a train path from a route, and offset from its start, and an envelope. */
    static TrainPath makeTrainPath(SignalingRoute route, double startOffset, double endOffset) {
        var routeLength = route.getInfraRoute().getLength();
        if (endOffset > routeLength) {
            assert Math.abs(endOffset - routeLength) < POSITION_EPSILON;
            endOffset = routeLength;
        }
        assert 0 <= startOffset && startOffset <= routeLength;
        assert 0 <= endOffset && endOffset <= routeLength;
        assert startOffset <= endOffset;
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
        var routes = new ArrayList<SignalingRoute>();
        for (var range : ranges)
            if (routes.isEmpty() || !Iterables.getLast(routes).equals(range.edge().route()))
                routes.add(range.edge().route());
        return TrainPathBuilder.from(routes, start, end);
    }
}
