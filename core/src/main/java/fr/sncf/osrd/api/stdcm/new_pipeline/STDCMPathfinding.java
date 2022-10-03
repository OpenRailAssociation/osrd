package fr.sncf.osrd.api.stdcm.new_pipeline;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;

import com.google.common.collect.Multimap;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class STDCMPathfinding {

    /** Given an infra, a rolling stock and a collection of unavailable time for each route,
     * find a path made of a sequence of route ranges with a matching envelope.
     * Returns null if no path is found.
     * */
    public static STDCMResult findPath(
            SignalingInfra infra,
            RollingStock rollingStock,
            double startTime,
            double endTime,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> startLocations,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> endLocations,
            Multimap<SignalingRoute, OccupancyBlock> unavailableTimes
    ) {
        var graph = new STDCMGraph(infra, rollingStock, unavailableTimes);
        var path = Pathfinding.findPath(
                graph,
                List.of(
                        convertLocations(graph, startLocations, startTime, true),
                        convertLocations(graph, endLocations, 0, false)
                ),
                edge -> edge.route().getInfraRoute().getLength(),
                null
        );
        if (path == null)
            return null;
        return makeResult(path, rollingStock);
    }

    /** Builds the STDCM result object from the raw pathfinding result */
    private static STDCMResult makeResult(Pathfinding.Result<STDCMGraph.Edge> path, RollingStock rollingStock) {
        var routeRanges = path.ranges().stream()
                .map(x -> new Pathfinding.EdgeRange<>(x.edge().route(), x.start(), x.end()))
                .toList();
        var routeWaypoints = path.waypoints().stream()
                .map(x -> new Pathfinding.EdgeLocation<>(x.edge().route(), x.offset()))
                .toList();
        var physicsPath = makePhysicsPath(path.ranges());
        return new STDCMResult(
                new Pathfinding.Result<>(routeRanges, routeWaypoints),
                makeFinalEnvelope(path.ranges(), rollingStock, physicsPath),
                makeTrainPath(path.ranges()),
                physicsPath
        );
    }

    /** Builds the final envelope, assembling the parts together and adding the final braking curve */
    private static Envelope makeFinalEnvelope(
            List<Pathfinding.EdgeRange<STDCMGraph.Edge>> edges,
            RollingStock rollingStock,
            PhysicsPath physicsPath
    ) {
        var parts = new ArrayList<EnvelopePart>();
        double offset = 0;
        for (var edge : edges) {
            var envelope = Envelope.make(edge.edge().envelope().slice(0, Math.abs(edge.end() - edge.start())));
            for (var part : envelope)
                parts.add(part.copyAndShift(offset));
            offset += edge.edge().envelope().getEndPos();
        }
        var newEnvelope = Envelope.make(parts.toArray(new EnvelopePart[0]));
        return addFinalBraking(newEnvelope, rollingStock, physicsPath);
    }

    /** Adds the final braking curve to the envelope */
    private static Envelope addFinalBraking(
            Envelope envelope,
            RollingStock rollingStock,
            PhysicsPath physicsPath
    ) {
        var context = new EnvelopeSimContext(rollingStock, physicsPath, 2.);
        return MaxSpeedEnvelope.from(context, new double[]{envelope.getEndPos()}, envelope);
    }

    public static List<TrackRangeView> truncateTrackRange(SignalingRoute route, double start, double end) {
        double offset = 0;
        var res = new ArrayList<TrackRangeView>();
        var infraRoute = route.getInfraRoute();
        for (var trackRange : infraRoute.getTrackRanges()) {
            var oldOffset = offset;
            offset += trackRange.getLength();
            if (end < oldOffset + trackRange.getLength())
                trackRange = trackRange.truncateEndByLength(trackRange.getLength() + oldOffset - end);
            if (start > oldOffset)
                trackRange = trackRange.truncateBeginByLength(start - oldOffset);
            if (trackRange.getLength() > 0)
                res.add(trackRange);
        }
        return res;
    }

    private static List<TrackRangeView> makeTrackRanges(
            List<Pathfinding.EdgeRange<STDCMGraph.Edge>> edges
    ) {
        var trackRanges = new ArrayList<TrackRangeView>();
        for (var routeRange : edges)
            trackRanges.addAll(truncateTrackRange(routeRange.edge().route(), routeRange.start(), routeRange.end()));
        return trackRanges;
    }

    /** Builds a PhysicsPath from the pathfinding edges */
    private static PhysicsPath makePhysicsPath(
            List<Pathfinding.EdgeRange<STDCMGraph.Edge>> edges
    ) {
        return EnvelopeTrainPath.from(makeTrackRanges(edges));
    }

    private static TrainPath makeTrainPath(
            List<Pathfinding.EdgeRange<STDCMGraph.Edge>> ranges
    ) {
        var routeList = ranges.stream()
                .map(edge -> edge.edge().route())
                .toList();
        var trackRanges = makeTrackRanges(ranges);
        var lastRange = trackRanges.get(trackRanges.size() - 1);
        return TrainPathBuilder.from(
                routeList,
                trackRanges.get(0).offsetLocation(0),
                lastRange.offsetLocation(lastRange.getLength())
        );
    }


    /** Converts a location on a SignalingRoute into a location on a STDCMGraph.Edge */
    private static Set<Pathfinding.EdgeLocation<STDCMGraph.Edge>> convertLocations(
            STDCMGraph graph,
            Set<Pathfinding.EdgeLocation<SignalingRoute>> locations,
            double startTime,
            boolean isStart
    ) {
        var res = new HashSet<Pathfinding.EdgeLocation<STDCMGraph.Edge>>();
        for (var location : locations) {
            var start = isStart ? location.offset() : 0;
            var end = location.edge().getInfraRoute().getLength();
            var edge = graph.makeEdge(location.edge(), startTime, 0, start, end);
            if (!isStart || !graph.isUnavailable(edge))
                res.add(new Pathfinding.EdgeLocation<>(edge, location.offset()));
        }
        return res;
    }
}
