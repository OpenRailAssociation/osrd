package fr.sncf.osrd.infra.implementation.signaling.modules.bal3;

import com.google.common.collect.ImmutableMap;
import com.google.common.collect.ImmutableMultimap;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.infra.api.signaling.Signal;
import fr.sncf.osrd.infra.api.signaling.SignalState;
import fr.sncf.osrd.infra.api.signaling.SignalingModule;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackEdge;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeDirection;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;
import fr.sncf.osrd.railjson.schema.infra.trackobjects.RJSSignal;
import fr.sncf.osrd.reporting.warnings.Warning;
import fr.sncf.osrd.reporting.warnings.DiagnosticRecorder;
import java.util.HashMap;
import java.util.Map;

/** This module implements the BAL3 signaling system.
 * It will eventually be moved to an external module */
public class BAL3 implements SignalingModule {

    private final DiagnosticRecorder diagnosticRecorder;

    public enum Aspect {
        GREEN,
        YELLOW,
        RED
    }

    public BAL3(DiagnosticRecorder diagnosticRecorder) {
        this.diagnosticRecorder = diagnosticRecorder;
    }

    private final Map<DiDetector, BAL3Signal> detectorToSignal = new HashMap<>();

    public record BAL3Route(
            ReservationRoute infraRoute,
            Signal<?> entrySignal,
            Signal<?> exitSignal
    ) implements SignalingRoute {
        @Override
        public ReservationRoute getInfraRoute() {
            return infraRoute;
        }

        @Override
        public Signal<?> getEntrySignal() {
            return entrySignal;
        }

        @Override
        public Signal<? extends SignalState> getExitSignal() {
            return exitSignal;
        }

        public String getSignalingType() {
            return "BAL3";
        }
    }

    private DiTrackEdge getLinkedTrackSection(DiTrackInfra infra, DiTrackEdge curEdge) {
        var graph = infra.getDiTrackGraph();
        var nodes = graph.incidentNodes(curEdge);
        var endNode = nodes.nodeV();
        var neighbors = graph.outEdges(endNode);
        // look for a neighboring track section
        // neighboring edges are either switch branches or track sections
        DiTrackEdge neighborTrack = null;
        for (var neighbor : neighbors) {
            if (neighbor.getEdge() instanceof TrackSection) {
                neighborTrack = neighbor;
                break;
            }
        }
        return neighborTrack;
    }

    private DiDetector getNextDetector(DiTrackInfra infra, DiTrackEdge curEdge) {
        while (true) {
            curEdge = getLinkedTrackSection(infra, curEdge);
            if (curEdge == null)
                return null;
            var curTrackSection = (TrackSection) curEdge.getEdge();
            var detectors = curTrackSection.getDetectors();
            if (detectors.isEmpty())
                continue;
            var detector = detectors.get(curEdge.getDirection() == Direction.FORWARD ? 0 : detectors.size() - 1);
            return detector.getDiDetector(curEdge.getDirection());
        }
    }

    private DiDetector findAssociatedDetector(ReservationInfra infra, RJSSignal signal) {
        var signalPosition = signal.position;
        var trackSection = infra.getTrackSection(signal.track);
        if (signal.direction == EdgeDirection.START_TO_STOP) {
            // look for a detector in the same track section at the signal
            for (var detector : trackSection.getDetectors()) {
                if (detector.getOffset() < signalPosition)
                    continue;
                if (detector.getOffset() >= signalPosition)
                    return detector.getDiDetector(Direction.FORWARD);
            }
            // if that fails, look for linked track sections
            return getNextDetector(infra, infra.getEdge(trackSection, Direction.FORWARD));
        } else {
            // look for a detector in the same track section at the signal
            for (var detector : trackSection.getDetectors().reverse()) {
                if (detector.getOffset() > signalPosition)
                    continue;
                if (detector.getOffset() <= signalPosition)
                    return detector.getDiDetector(Direction.BACKWARD);
            }
            // if that fails, look for linked track sections
            return getNextDetector(infra, infra.getEdge(trackSection, Direction.BACKWARD));
        }
    }

    @Override
    public ImmutableMap<RJSSignal, Signal<?>> createSignals(ReservationInfra infra, RJSInfra rjsInfra) {
        var res = ImmutableMap.<RJSSignal, Signal<?>>builder();
        for (var signal : rjsInfra.signals) {
            if (!isBALSignal(signal))
                continue;
            // automatically find the associated detector (all BAL3 signals are supposed to have one)
            var linkedDetector = findAssociatedDetector(infra, signal);
            if (linkedDetector == null)
                diagnosticRecorder.register(new Warning(String.format(
                        "Can't find associated detector for signal %s", signal.id
                )));
            var newSignal = new BAL3Signal(signal.id, signal.sightDistance);
            res.put(signal, newSignal);
            detectorToSignal.put(linkedDetector, newSignal);
        }
        return res.build();
    }

    @Override
    public ImmutableMap<ReservationRoute, SignalingRoute> createRoutes(
            ReservationInfra infra,
            ImmutableMultimap<RJSSignal, Signal<?>> signalMap
    ) {
        var res = ImmutableMap.<ReservationRoute, SignalingRoute>builder();
        var graph = infra.getInfraRouteGraph();
        for (var infraRoute : graph.edges()) {
            if (!isBALRoute(infraRoute))
                continue;
            var detectors = graph.incidentNodes(infraRoute);
            var startSignal = detectorToSignal.get(detectors.nodeU());
            var endSignal = detectorToSignal.get(detectors.nodeV());
            if (startSignal == null && graph.inEdges(detectors.nodeU()).size() > 0)
                diagnosticRecorder.register(new Warning(String.format(
                        "Can't find BAL entry signal for route %s (entry point: %s)",
                        infraRoute.getID(), detectors.nodeU()
                )));
            var newRoute = new BAL3Route(infraRoute, startSignal, endSignal);
            res.put(infraRoute, newRoute);
            if (startSignal != null) {
                startSignal.protectedRoutes.add(newRoute);
                if (endSignal != null)
                    startSignal.signalDependencies.add(endSignal);
            }
        }
        for (var signal : signalMap.values())
            if (signal instanceof BAL3Signal bal3Signal)
                bal3Signal.setup();
        return res.build();
    }

    private static boolean isBALSignal(RJSSignal signal) {
        // TODO
        return true;
    }

    private static boolean isBALRoute(ReservationRoute route) {
        // TODO
        return true;
    }
}
