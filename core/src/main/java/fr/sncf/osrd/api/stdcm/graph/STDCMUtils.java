package fr.sncf.osrd.api.stdcm.graph;

import com.google.common.primitives.Doubles;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.ImpossibleSimulationError;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

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

    /** Create an EnvelopeSimContext instance from the route and extra parameters */
    static EnvelopeSimContext makeSimContext(
            List<SignalingRoute> routes,
            double offsetFirstRoute,
            RollingStock rollingStock,
            RollingStock.Comfort comfort,
            double timeStep
    ) {
        var tracks = new ArrayList<TrackRangeView>();
        for (var route : routes) {
            var routeLength = route.getInfraRoute().getLength();
            tracks.addAll(route.getInfraRoute().getTrackRanges(offsetFirstRoute, routeLength));
            offsetFirstRoute = 0;
        }
        var envelopePath = EnvelopeTrainPath.from(tracks);
        return new EnvelopeSimContext(rollingStock, envelopePath, timeStep, comfort);
    }

    /** Returns an envelope matching the given route. The envelope time starts when the train enters the route.
     *
     * <p>
     * Note: there are some approximations made here as we only "see" the tracks on the given routes.
     * We are missing slopes and speed limits from earlier in the path.
     * </p>
     * This is public because it helps when writing unit tests. */
    public static Envelope simulateRoute(
            SignalingRoute route,
            double initialSpeed,
            double start,
            RollingStock rollingStock,
            RollingStock.Comfort comfort,
            double timeStep,
            double[] stops,
            String tag
    ) {
        try {
            var context = makeSimContext(List.of(route), start, rollingStock, comfort, timeStep);
            var mrsp = MRSP.from(
                    route.getInfraRoute().getTrackRanges(start, start + context.path.getLength()),
                    rollingStock,
                    false,
                    tag
            );
            var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp);
            return MaxEffortEnvelope.from(context, initialSpeed, maxSpeedEnvelope);
        } catch (ImpossibleSimulationError e) {
            // This can happen when the train can't go through this part,
            // for example because of high slopes with a "weak" rolling stock
            return null;
        }
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

    /** Returns the time at which the offset on the given route is reached */
    public static double interpolateTime(
            Envelope envelope,
            SignalingRoute route,
            double routeOffset,
            double startTime
    ) {
        var routeLength = route.getInfraRoute().getLength();
        var envelopeStartOffset = routeLength - envelope.getEndPos();
        var envelopeOffset = Math.max(0, routeOffset - envelopeStartOffset);
        assert envelopeOffset <= envelope.getEndPos();
        return startTime + envelope.interpolateTotalTime(envelopeOffset);
    }
}
